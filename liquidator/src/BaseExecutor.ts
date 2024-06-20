import { SigningStargateClient } from '@cosmjs/stargate'
import { Coin } from '@cosmjs/proto-signing'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { RedisInterface } from './redis.js'
import { AMMRouter } from './AmmRouter.js'
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
	liquidatorMasterAddress: string
	gasDenom: string
	neutralAssetDenom: string
	logResults: boolean
	redisEndpoint: string
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
		public redis : RedisInterface = new RedisInterface(),
		public ammRouter : AMMRouter = new AMMRouter()
	) {}

	async initiateRedis(): Promise<void> {
		await this.redis.connect(this.config.redisEndpoint)
	}

	async initiateAstroportPoolProvider(): Promise<void> {
		const astroportPoolProvider = this.poolProvider as AstroportPoolProvider;

		if (astroportPoolProvider) {
  			await astroportPoolProvider.initiate();
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
		await this.refreshPoolData()
	}

	refreshMarketData = async() => {
		let markets : MarketInfo[] = []
		let fetching = true
		let start_after = ""
		while (fetching) {
			const response = await this.queryClient.queryContractSmart(this.config.redbankAddress, {
				markets: {
					start_after,
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

	refreshPoolData = async () => {
		const currentTime = Date.now()

		if (this.poolsNextRefresh < currentTime) {

			const pools = await this.poolProvider.loadPools()
			this.ammRouter.setPools(pools)
			this.poolsNextRefresh = Date.now() + this.config.poolsRefreshWindow
		}
	}
}
