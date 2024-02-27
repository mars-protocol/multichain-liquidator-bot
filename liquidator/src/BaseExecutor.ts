import { SigningStargateClient } from '@cosmjs/stargate'
import { Coin, EncodeObject, coins } from '@cosmjs/proto-signing'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { AMMRouter } from './AmmRouter.js'
import { ConcentratedLiquidityPool, Pool, PoolType, XYKPool } from "./types/Pool"
import 'dotenv/config.js'
import { MarketInfo } from './rover/types/MarketInfo.js'
import { CSVWriter, Row } from './CsvWriter.js'

import BigNumber from 'bignumber.js'
import { fetchRedbankData } from './query/hive.js'
import { PriceResponse } from 'marsjs-types/creditmanager/generated/mars-mock-oracle/MarsMockOracle.types.js'
import { PoolDataProviderInterface } from './query/amm/PoolDataProviderInterface.js'
import { AstroportPoolProvider } from './query/amm/AstroportPoolProvider.js'

export interface BaseExecutorConfig {
	lcdEndpoint: string
	chainName: string
	hiveEndpoint: string
	oracleAddress: string
	redbankAddress: string
	marsParamsAddress: string
	liquidatorMasterAddress: string
	gasDenom: string
	neutralAssetDenom: string
	logResults: boolean
	poolsRefreshWindow: number
	astroportFactory?: string
	astroportRouter?: string
	marsEndpoint?: string
}

/**
 * Executor class is the entry point for the executor service
 * @param config holds the neccessary configuration for the executor to operate
 */
export class BaseExecutor {

	// Data
	public prices: Map<string, number> = new Map()
	public balances: Map<string, number> = new Map()
	public markets: MarketInfo[] = []

	// variables
	private poolsNextRefresh = 0

	// logging
	private csvLogger = new CSVWriter('./results.csv', [
		{ id: 'blockHeight', title: 'BlockHeight' },
		{ id: 'userAddress', title: 'User' },
		{ id: 'estimatedLtv', title: 'LiquidationLtv' },
		{ id: 'debtRepaid', title: 'debtRepaid' },
		{ id: 'collateral', title: 'collateral' },
		{ id: 'liquidatorBalance', title: 'liquidatorBalance' },
	])

	constructor(
		public config: BaseExecutorConfig,
		public client: SigningStargateClient,
		public queryClient: CosmWasmClient,
		private poolProvider: PoolDataProviderInterface,
		public ammRouter : AMMRouter = new AMMRouter()
	) {
		console.log({config})
	}

	async initiateAstroportPoolProvider(): Promise<void> {
		if (this.config.chainName === "neutron") {
			const astroportPoolProvider = this.poolProvider as AstroportPoolProvider;
			await astroportPoolProvider.initiate()
		}
	}

	applyAvailableLiquidity = (market: MarketInfo): MarketInfo => {
		// Available liquidity = deposits - borrows. However, we need to
		// compute the underlying uasset amounts from the scaled amounts.
		const scalingFactor = 1e6
		const scaledDeposits = new BigNumber(market.collateral_total_scaled)
		const scaledBorrows = new BigNumber(market.debt_total_scaled)

		const descaledDeposits = scaledDeposits
			.multipliedBy(market.liquidity_index)
			.dividedBy(scalingFactor)
		const descaledBorrows = scaledBorrows.multipliedBy(market.borrow_index).dividedBy(scalingFactor)

		const availableLiquidity = descaledDeposits.minus(descaledBorrows)

		market.available_liquidity = availableLiquidity.toNumber()
		return market
	}

	setBalances = async (liquidatorAddress: string) => {
		const coinBalances: readonly Coin[] = await this.client.getAllBalances(liquidatorAddress)
		for (const index in coinBalances) {
			const coin = coinBalances[index]
			this.balances.set(coin.denom, Number(coin.amount))
		}
	}

	addCsvRow = (row: Row) => {
		this.csvLogger.addRow(row)
	}

	writeCsv = async () => {
		await this.csvLogger.writeToFile()
	}

	refreshData = async () => {
		// dispatch hive request and parse it

		const { wasm, bank } = await fetchRedbankData(
			this.config.hiveEndpoint,
			this.config.liquidatorMasterAddress,
			this.config.redbankAddress,
			this.config.oracleAddress,
		)

		bank.balance.forEach((coin) => this.balances.set(coin.denom, Number(coin.amount)))
		wasm.prices.forEach((price: PriceResponse) => this.prices.set(price.denom, Number(price.price)))
		await this.refreshMarketData()
		await this.refreshPoolData(this.prices, this.markets)
	}

	refreshMarketData = async() => {
		let markets : MarketInfo[] = []
		let fetching = true
		let start_after = ""
		while (fetching) {
			const response = await this.queryClient.queryContractSmart(this.config.redbankAddress, {
				markets: {
					start_after,
					limit: 5
				},
			})

			start_after = response[response.length - 1] ? response[response.length - 1].denom : ""
			markets = markets.concat(response)
			fetching = response.length === 5
		}

		this.markets = markets.map((market: MarketInfo) =>
			this.applyAvailableLiquidity(market),
		)
	}

	refreshPoolData = async (prices: Map<string, number>, markets: MarketInfo[]) => {
		const currentTime = Date.now()

		// 20000 USDC min liqudity denominated
		if (this.poolsNextRefresh < currentTime) {

			let pools = await this.poolProvider.loadPools()
			pools = this.validatePools(pools, markets, prices)

			// pool.poolType === PoolType.CONCENTRATED_LIQUIDITY
			this.ammRouter.setPools(pools)
			this.poolsNextRefresh = Date.now() + this.config.poolsRefreshWindow
		}
	}

	// Filter out pools that are invalid
	validatePools = (pools : Pool[], markets: MarketInfo[], prices: Map<string, number>) => {
		pools = pools.filter(pool => {
			let liquid = true
			if (pool.poolType === PoolType.CONCENTRATED_LIQUIDITY) {
				// TODO check liquidity
				liquid = (pool as ConcentratedLiquidityPool).liquidityDepths?.zeroToOne.length > 0 &&
				(pool as ConcentratedLiquidityPool).liquidityDepths?.oneToZero.length > 0
			} else if (pool.poolType === PoolType.XYK) {

				// TODO make env variable
				const minXykLiquidity = process.env.MIN_XYX_LIQUIDITY || 20000 * 1e6

				// Check liquidity is valid
				const tokenZero = markets.find(market => market.denom === pool.token0)
				const tokenOne = markets.find(market => market.denom === pool.token1)
				if (!tokenZero && !tokenOne) return false
				if (tokenZero) {
					liquid = new BigNumber(
						(pool as XYKPool)
						.poolAssets[0]
						.token
						.amount
					).multipliedBy(prices.get(pool.token0) || 0)
					.isGreaterThan(minXykLiquidity)
				} else if (tokenOne) {
					liquid = new BigNumber(
						(pool as XYKPool)
						.poolAssets[1]
						.token
						.amount
					).multipliedBy(prices.get(pool.token1) || 0)
					.isGreaterThan(minXykLiquidity)
				}
			}
			return liquid
		})

		return pools
	}

	// Calculate the fee for a transaction on osmosis. Incorporates EIP1559 dynamic base fee
	getOsmosisFee = async (msgs: EncodeObject[], address: string) => {
		if (!this.client)
			throw new Error(
				'Stargate Client is undefined, ensure you call initiate at before calling this method',
			)
		const gasPriceRequest = await fetch("https://lcd.osmosis.zone/osmosis/txfees/v1beta1/cur_eip_base_fee")
		const { base_fee: baseFee } = await gasPriceRequest.json()
		const gasEstimated = await this.client.simulate(address, msgs, '')
		const gas = Number(gasEstimated * 1.3)
		const gasPrice = Number(baseFee)
		const safeGasPrice = gasPrice < 0.025 ? 0.005 : gasPrice
		const amount = coins(((gas * safeGasPrice)+1).toFixed(0), this.config.gasDenom)
		const fee = {
			amount,
			gas: gas.toFixed(0),
		}

		return fee
	}
}
