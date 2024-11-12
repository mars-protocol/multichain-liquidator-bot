import { SigningStargateClient, StdFee } from '@cosmjs/stargate'
import { Coin, EncodeObject, coins } from '@cosmjs/proto-signing'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { AMMRouter } from './AmmRouter'
import { ConcentratedLiquidityPool, Pool, PoolType, XYKPool } from "./types/Pool"
import 'dotenv/config.js'
import { MarketInfo } from './rover/types/MarketInfo'
import { CSVWriter, Row } from './CsvWriter'

import BigNumber from 'bignumber.js'
import { fetchRedbankData } from './query/hive'
import { PoolDataProvider } from './query/amm/PoolDataProviderInterface'
import { AstroportPoolProvider } from './query/amm/AstroportPoolProvider'
import { RouteRequester } from './query/routing/RouteRequesterInterface'
import { sleep } from './helpers'
import { OraclePriceFetcher as MarsOraclePriceFetcher } from './query/oracle/OraclePriceFetcher'
import { PythPriceFetcher } from './query/oracle/PythPriceFetcher'
import { OraclePrice } from './query/oracle/PriceFetcherInterface'
import { PriceSourceResponse } from './types/oracle'

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
	// The sidecar query server url
	sqsUrl?: string
	astroportFactory?: string
	astroportRouter?: string
	// The mars api endpoint
	marsEndpoint?: string
}

/**
 * Executor class is the entry point for the executor service
 * @param config holds the neccessary configuration for the executor to operate
 */
export class BaseExecutor {


	private priceSources : PriceSourceResponse[] = []

	private marsOraclePriceFetcher : MarsOraclePriceFetcher = new MarsOraclePriceFetcher(this.queryClient)
	private pythOraclePriceFetcher : PythPriceFetcher = new PythPriceFetcher()

	// Data
	public prices: Map<string, BigNumber> = new Map()
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
		public poolProvider: PoolDataProvider,
		public routeRequester: RouteRequester,
		public ammRouter : AMMRouter = new AMMRouter(),
	) {
		console.log({config})
	}

	async initiateAstroportPoolProvider(): Promise<void> {
		const astroportPoolProvider = this.poolProvider as AstroportPoolProvider;
		await astroportPoolProvider.initiate()
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

		const { bank } = await fetchRedbankData(
			this.config.hiveEndpoint,
			this.config.liquidatorMasterAddress,
			this.config.redbankAddress,
		)

		bank.balance.forEach((coin) => this.balances.set(coin.denom, Number(coin.amount)))

		await this.updatePriceSources()
		await this.updateOraclePrices()
		await this.refreshMarketData()
	}

	updatePriceSources = async () => {
		let priceSources : PriceSourceResponse[] = []
		let fetching = true
		let start_after = ""
		let retries = 0

		const maxRetries = 5
		const limit = 5

		while (fetching) {
			try {
				const response = await this.queryClient.queryContractSmart(this.config.oracleAddress, {
					price_sources: {
						limit,
						start_after,
					},
				})
				start_after = response[response.length - 1] ? response[response.length - 1].denom : ""
				priceSources = priceSources.concat(response)
				fetching = response.length === limit
				retries = 0
			} catch(e) {
				console.warn(e)
				retries++
				if (retries >= maxRetries) {
					console.warn("Max retries exceeded, exiting", maxRetries)
					fetching = false
				} else {
					await sleep(5000)
					console.info("Retrying...")
				}
			}
		}

		// don't override if we did not fetch all data.
		if (retries < maxRetries) {
			this.priceSources = priceSources
		}
	}

	updateOraclePrices = async () => {
		try {
			// Fetch all price sources
			const priceResults : PromiseSettledResult<OraclePrice>[] = await Promise.allSettled(this.priceSources.map(async (priceSource) => await this.fetchOraclePrice(priceSource.denom)))

			priceResults.forEach((oraclePriceResult) => {
				const successfull = oraclePriceResult.status === 'fulfilled'
				const oraclePrice = successfull ? oraclePriceResult.value : null

				// push successfull price results
				if (successfull && oraclePrice) {
					this.prices.set(oraclePrice.denom, oraclePrice.price)
				}
			})
		} catch (e) {
			console.error(e)
		}
	}

	private fetchOraclePrice = async (denom: string) : Promise<OraclePrice> => {
		const priceSource : PriceSourceResponse | undefined = this.priceSources.find(ps => ps.denom === denom)
		if (!priceSource) {
			console.error(`No price source found for ${denom}`)
		}

		switch (priceSource?.price_source!.toString()) {
			case 'fixed':
			case 'spot':
				// todo - support via pool query. These will default to oracle price 
			case 'arithmetic_twap':
			case 'geometric_twap':
			case 'xyk_liquidity_token':
			case 'lsd':
			case 'staked_geometric_twap':
				return await this.marsOraclePriceFetcher.fetchPrice({
					oracleAddress: this.config.oracleAddress,
					priceDenom: denom
				})
			case 'pyth':

				const pyth : {
					price_feed_id: string,
					denom_decimals : number
				//@ts-expect-error - our generated types don't handle this case
				} =  priceSource.price_source.pyth
				
				return await this.pythOraclePriceFetcher.fetchPrice({
					priceFeedId:pyth.price_feed_id,
					denomDecimals: pyth.denom_decimals,
					denom: denom
				})
			  // Handle other cases for different price source types	  
			default:
				// Handle unknown or unsupported price source types
				return await this.marsOraclePriceFetcher.fetchPrice({
					oracleAddress: this.config.oracleAddress,
					priceDenom: denom
				})
		}
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

		if (this.poolsNextRefresh < currentTime) {

			let pools = await this.poolProvider.loadPools()
			pools = this.validatePools(pools, markets, prices)

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

	getFee = async (msgs: EncodeObject[], address: string, chainName: string) => {
		if (chainName === "osmosis") {
			return this.getOsmosisFee(msgs, address)
		} else {
			return this.getNeutronFee(msgs, address)
		}
	}

	// Calculate the fee for a transaction on osmosis. Incorporates EIP1559 dynamic base fee
	getOsmosisFee = async (msgs: EncodeObject[], address: string) => {
		if (!this.client)
			throw new Error(
				'Stargate Client is undefined, ensure you call initiate at before calling this method',
			)
		const gasPriceRequest = await fetch(`${process.env.LCD_ENDPOINT}/osmosis/txfees/v1beta1/cur_eip_base_fee?x-apikey=${process.env.API_KEY}`)
		const { base_fee: baseFee } = await gasPriceRequest.json()
		const gasEstimated = await this.client.simulate(address, msgs, '')
		const gas = Number(gasEstimated * 1.3)
		const gasPrice = Number(baseFee)
		const safeGasPrice = gasPrice < 0.025 ? 0.025 : gasPrice
		const amount = coins((((gas * safeGasPrice)+1)).toFixed(0), this.config.gasDenom)
		const fee = {
			amount,
			gas: gas.toFixed(0),
		}

		return fee
	}

	getNeutronFee = async (msgs: EncodeObject[], address: string) : Promise<StdFee> => {
		if (!this.client)
			throw new Error(
				'Stargate Client is undefined, ensure you call initiate at before calling this method',
			)
		const gasPriceRequest = await fetch(`${process.env.LCD_ENDPOINT}/gaia/globalfee/v1beta1/params`)
		const fees : { params: { minimum_gas_prices : {denom: string, amount: string}[]}}= await gasPriceRequest.json()
		const baseFee = fees.params.minimum_gas_prices.filter((price) => price.denom === "untrn")[0] //todo default here
		const gasPrice = Number(baseFee.amount)
		const gasEstimated = await this.client.simulate(address, msgs, '')
		const gas = Number(gasEstimated * 1.8)
		const safeGasPrice = gasPrice < 0.025 ? 0.025 : gasPrice
		const amount = coins((((gas * safeGasPrice)+1)).toFixed(0), this.config.gasDenom)
		const fee = {
			amount,
			gas: gas.toFixed(0),
		}
	
		return fee
	}
}