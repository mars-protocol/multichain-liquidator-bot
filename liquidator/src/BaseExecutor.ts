import { SigningStargateClient } from '@cosmjs/stargate'
import { Coin } from '@cosmjs/proto-signing'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { RedisInterface } from './redis.js'
import { AMMRouter } from './amm_router.js'
import fetch from 'cross-fetch'
import { Pagination, Pool } from './types/Pool.js'
import 'dotenv/config.js'
import { MarketInfo } from './rover/types/MarketInfo.js'
import { CSVWriter, Row } from './CsvWriter.js'
import { camelCaseKeys } from './helpers.js'
import BigNumber from 'bignumber.js'
import { fetchData } from './hive.js'
import { PriceResponse } from 'marsjs-types/creditmanager/generated/mars-mock-oracle/MarsMockOracle.types.js'

export interface BaseExecutorConfig {
	lcdEndpoint: string
	hiveEndpoint: string
	oracleAddress: string
	redbankAddress: string
	liquidatorMasterAddress: string
	gasDenom: string
	neutralAssetDenom: string
	logResults: boolean
	redisEndpoint: string
}

/**
 * Executor class is the entry point for the executor service
 * @param config holds the neccessary configuration for the executor to operate
 */
export class BaseExecutor {
	public ammRouter: AMMRouter
	public redis: RedisInterface
	public prices: Map<string, number> = new Map()
	public balances: Map<string, number> = new Map()
	public markets: MarketInfo[] = []

	public config: BaseExecutorConfig

	public client: SigningStargateClient
	public queryClient: CosmWasmClient

	private csvLogger = new CSVWriter('./results.csv', [
		{ id: 'blockHeight', title: 'BlockHeight' },
		{ id: 'userAddress', title: 'User' },
		{ id: 'estimatedLtv', title: 'LiquidationLtv' },
		{ id: 'debtRepaid', title: 'debtRepaid' },
		{ id: 'collateral', title: 'collateral' },
		{ id: 'liquidatorBalance', title: 'liquidatorBalance' },
	])
	constructor(
		config: BaseExecutorConfig,
		client: SigningStargateClient,
		queryClient: CosmWasmClient,
	) {
		this.config = config
		this.ammRouter = new AMMRouter()
		this.redis = new RedisInterface()
		this.client = client
		this.queryClient = queryClient
	}

	async initiate(): Promise<void> {
		await this.redis.connect()
		await this.refreshData()
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
		const { wasm, bank } = await fetchData(
			this.config.hiveEndpoint,
			this.config.liquidatorMasterAddress,
			this.config.redbankAddress,
			this.config.oracleAddress,
		)

		this.markets = wasm.markets.map((market: MarketInfo) => this.applyAvailableLiquidity(market))
		bank.balance.forEach((coin) => this.balances.set(coin.denom, Number(coin.amount)))
		wasm.prices.forEach((price: PriceResponse) => this.prices.set(price.denom, Number(price.price)))

		const pools = await this.loadPools()
		this.ammRouter.setPools(pools)
	}

	loadPools = async (): Promise<Pool[]> => {
		let fetchedAllPools = false
		let nextKey = ''
		let pools: Pool[] = []
		let totalPoolCount = 0
		while (!fetchedAllPools) {
			const response = await fetch(
				`${this.config.lcdEndpoint}/osmosis/gamm/v1beta1/pools${nextKey}`,
			)
			const responseJson: any = await response.json()
			const pagination = camelCaseKeys(responseJson.pagination) as Pagination

			// osmosis lcd query returns total pool count as 0 after page 1 (but returns the correct count on page 1), so we need to only set it once
			if (totalPoolCount === 0) {
				totalPoolCount = pagination.total
			}

			const poolsRaw = responseJson.pools as Pool[]

			poolsRaw.forEach((pool) => pools.push(camelCaseKeys(pool) as Pool))

			nextKey = `?pagination.key=${pagination.nextKey}`
			if (pools.length >= totalPoolCount) {
				fetchedAllPools = true
			}
		}

		return pools
	}
}
