import { SigningStargateClient, StdFee } from '@cosmjs/stargate'
import { Coin, EncodeObject, coins } from '@cosmjs/proto-signing'
import { AMMRouter } from './AmmRouter'
import { ConcentratedLiquidityPool, Pool, PoolType, XYKPool } from './types/Pool'
import 'dotenv/config.js'
import { MarketInfo } from './rover/types/MarketInfo'
import { CSVWriter, Row } from './CsvWriter'

import BigNumber from 'bignumber.js'
import { RouteRequester } from './query/routing/RouteRequesterInterface'
import { sleep } from './helpers'
import { PriceSourceResponse } from './types/oracle'
import { AssetParamsBaseForAddr, PerpParams } from 'marsjs-types/mars-params/MarsParams.types'
import { ChainQuery } from './query/chainQuery'
import { PriceResponse } from 'marsjs-types/mars-oracle-osmosis/MarsOracleOsmosis.types'
import { Market } from 'marsjs-types/mars-red-bank/MarsRedBank.types'
import { Dictionary } from 'lodash'

export interface BaseConfig {
	lcdEndpoint: string
	chainName: string
	productName: string
	contracts: Dictionary<string>
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
	private priceSources: PriceSourceResponse[] = []

	// Data
	public prices: Map<string, BigNumber> = new Map()
	public balances: Map<string, number> = new Map()
	public markets: Map<string, MarketInfo> = new Map()
	public assetParams: Map<string, AssetParamsBaseForAddr> = new Map()
	public perpParams: Map<string, PerpParams> = new Map()

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
		public config: BaseConfig,
		public signingClient: SigningStargateClient,
		public queryClient: ChainQuery,
		public routeRequester: RouteRequester,
		public ammRouter: AMMRouter = new AMMRouter(),
	) {
		console.log({ config })
	}

	applyAvailableLiquidity = (market: Market): MarketInfo => {
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

		const marketInfo = {
			available_liquidity: availableLiquidity,
			...market,
		}

		return marketInfo
	}

	setBalances = async (liquidatorAddress: string) => {
		const coinBalances: readonly Coin[] = await this.signingClient.getAllBalances(liquidatorAddress)
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

	init = async () => {
		// dispatch hive request and parse it

		await this.updatePriceSources()
		await this.updateOraclePrices()
		await this.updatePrices()
		await this.updateMarketsData()
		await this.updateAssetParams()
	}

	updatePrices = async () => {
		await this.updatePriceSources()
		await this.updateOraclePrices()
	}

	updatePriceSources = async () => {
		let priceSources: PriceSourceResponse[] = []
		let fetching = true
		let start_after = ''
		let retries = 0

		const maxRetries = 5
		const limit = 5

		while (fetching) {
			try {
				const response = await this.queryClient.queryOraclePriceSources(start_after, limit)
				start_after = response[response.length - 1] ? response[response.length - 1].denom : ''
				priceSources = priceSources.concat(response)
				fetching = response.length === limit
				retries = 0
			} catch (e) {
				console.warn(e)
				retries++
				if (retries >= maxRetries) {
					console.warn('Max retries exceeded, exiting', maxRetries)
					fetching = false
				} else {
					await sleep(5000)
					console.info('Retrying...')
				}
			}
		}

		// don't override if we did not fetch all data.
		if (retries < maxRetries) {
			this.priceSources = priceSources
		}
	}

	updatePerpParams = async () => {
		let perpParams: PerpParams[] = []
		let fetching = true
		let start_after = ''
		let retries = 0

		const maxRetries = 5
		const limit = 5

		while (fetching) {
			try {
				const response = await this.queryClient.queryPerpParams(start_after, limit)
				start_after = response[response.length - 1] ? response[response.length - 1].denom : ''
				perpParams = perpParams.concat(response)
				fetching = response.length === limit
				retries = 0
			} catch (e) {
				console.warn(e)
				retries++
				if (retries >= maxRetries) {
					console.warn('Max retries exceeded, exiting', maxRetries)
					fetching = false
				} else {
					await sleep(5000)
					console.info('Retrying...')
				}
			}
		}

		// don't override if we did not fetch all data.
		if (retries < maxRetries) {
			perpParams.forEach((perpParam) => {
				this.perpParams.set(perpParam.denom, perpParam)
			})
		}
	}

	updateAssetParams = async () => {
		const maxRetries = 5
		const limit = 5

		// while not returning empty, get all asset params
		let fetching = true
		let startAfter = ''
		let retries = 0
		while (fetching) {
			try {
				const response = await this.queryClient.queryAllAssetParams(startAfter, limit)
				startAfter = response[response.length - 1] ? response[response.length - 1].denom : ''
				response.forEach((assetParam: AssetParamsBaseForAddr) => {
					this.assetParams.set(assetParam.denom, assetParam)
				})
				fetching = response.length === 5
				retries = 0
			} catch (ex) {
				console.warn(ex)
				retries++
				if (retries > maxRetries) {
					console.warn('Max retries exceeded, exiting', maxRetries)
					fetching = false
				} else {
					await sleep(5000)
					console.info('Retrying...')
				}
			}
		}
	}

	updateOraclePrices = async () => {
		try {
			// Fetch all price sources
			const priceResults: PromiseSettledResult<PriceResponse>[] = await Promise.allSettled(
				this.priceSources.map(
					async (priceSource) => await this.queryClient.queryOraclePrice(priceSource.denom),
				),
			)

			priceResults.forEach((oraclePriceResult) => {
				const successfull = oraclePriceResult.status === 'fulfilled'
				const oraclePrice = successfull ? oraclePriceResult.value : null

				// push successfull price results
				if (successfull && oraclePrice) {
					this.prices.set(oraclePrice.denom, new BigNumber(oraclePrice.price))
				}
			})
		} catch (e) {
			console.error(e)
		}
	}

	updateMarketsData = async () => {
		let markets: Market[] = []
		let fetching = true
		let limit = 5
		let start_after = ''
		while (fetching) {
			const response = await this.queryClient.queryMarkets(start_after, limit)
			start_after = response[response.length - 1] ? response[response.length - 1].denom : ''
			markets = markets.concat(response)
			fetching = response.length === 5
		}

		this.markets = new Map(
			markets.map((market) => [market.denom, this.applyAvailableLiquidity(market)]),
		)
	}

	// Filter out pools that are invalid
	validatePools = (pools: Pool[], markets: MarketInfo[], prices: Map<string, number>) => {
		pools = pools.filter((pool) => {
			let liquid = true
			if (pool.poolType === PoolType.CONCENTRATED_LIQUIDITY) {
				// TODO check liquidity
				liquid =
					(pool as ConcentratedLiquidityPool).liquidityDepths?.zeroToOne.length > 0 &&
					(pool as ConcentratedLiquidityPool).liquidityDepths?.oneToZero.length > 0
			} else if (pool.poolType === PoolType.XYK) {
				// TODO make env variable
				const minXykLiquidity = process.env.MIN_XYX_LIQUIDITY || 20000 * 1e6

				// Check liquidity is valid
				const tokenZero = markets.find((market) => market.denom === pool.token0)
				const tokenOne = markets.find((market) => market.denom === pool.token1)
				if (!tokenZero && !tokenOne) return false
				if (tokenZero) {
					liquid = new BigNumber((pool as XYKPool).poolAssets[0].token.amount)
						.multipliedBy(prices.get(pool.token0) || 0)
						.isGreaterThan(minXykLiquidity)
				} else if (tokenOne) {
					liquid = new BigNumber((pool as XYKPool).poolAssets[1].token.amount)
						.multipliedBy(prices.get(pool.token1) || 0)
						.isGreaterThan(minXykLiquidity)
				}
			}
			return liquid
		})

		return pools
	}

	getFee = async (msgs: EncodeObject[], address: string, chainName: string) => {
		if (chainName === 'osmosis') {
			return this.getOsmosisFee(msgs, address)
		} else {
			return this.getNeutronFee(msgs, address)
		}
	}

	// Calculate the fee for a transaction on osmosis. Incorporates EIP1559 dynamic base fee
	getOsmosisFee = async (msgs: EncodeObject[], address: string) => {
		if (!this.signingClient)
			throw new Error(
				'Stargate Client is undefined, ensure you call initiate at before calling this method',
			)
		const gasPriceRequest = await fetch(
			`${process.env.LCD_ENDPOINT}/osmosis/txfees/v1beta1/cur_eip_base_fee?x-apikey=${process.env.API_KEY}`,
		)
		const { base_fee: baseFee } = await gasPriceRequest.json()
		const gasEstimated = await this.signingClient.simulate(address, msgs, '')
		const gas = Number(gasEstimated * 1.3)
		const gasPrice = Number(baseFee)
		const safeGasPrice = gasPrice < 0.025 ? 0.025 : gasPrice
		const amount = coins((gas * safeGasPrice + 1).toFixed(0), this.config.gasDenom)
		const fee = {
			amount,
			gas: gas.toFixed(0),
		}

		return fee
	}

	getNeutronFee = async (msgs: EncodeObject[], address: string): Promise<StdFee> => {
		if (!this.signingClient)
			throw new Error(
				'Stargate Client is undefined, ensure you call initiate at before calling this method',
			)
		const gasPriceRequest = await fetch(`${process.env.LCD_ENDPOINT}/gaia/globalfee/v1beta1/params`)
		const fees: { params: { minimum_gas_prices: { denom: string; amount: string }[] } } =
			await gasPriceRequest.json()
		const baseFee = fees.params.minimum_gas_prices.filter((price) => price.denom === 'untrn')[0] //todo default here
		const gasPrice = Number(baseFee.amount)
		const gasEstimated = await this.signingClient.simulate(address, msgs, '')
		const gas = Number(gasEstimated * 1.8)
		const safeGasPrice = gasPrice < 0.025 ? 0.025 : gasPrice
		const amount = coins((gas * safeGasPrice + 1).toFixed(0), this.config.gasDenom)
		const fee = {
			amount,
			gas: gas.toFixed(0),
		}

		return fee
	}
}
