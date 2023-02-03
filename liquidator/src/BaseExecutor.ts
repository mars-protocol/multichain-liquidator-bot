import { LiquidationHelper } from './liquidationHelpers.js'
import { SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { Coin, coins, DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { RedisInterface } from './redis.js'
import BigNumber from 'bignumber.js'
import { AMMRouter } from './amm_router.js'
import fetch from 'node-fetch'
import { Pagination, Pool } from './types/Pool.js'
import 'dotenv/config.js'
import { MarketInfo } from './rover/types/MarketInfo.js'
import camelcaseKeys from 'camelcase-keys'
import { CSVWriter, Row } from './CsvWriter.js'

interface Price {
  price: number
  denom: string
}

export interface BaseExecutorConfig {
  lcdEndpoint: string
  hiveEndpoint: string
  oracleAddress: string
  redbankAddress: string
  liquidatorMasterAddress: string
  gasDenom: string
  neutralAssetDenom: string
  logResults : boolean
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
    await this.setMarkets()
    await this.setBalances(this.config.liquidatorMasterAddress)
    await this.setPrices()
  }

  setMarkets = async () => {
    const newMarkets = await this.queryClient.queryContractSmart(this.config.redbankAddress, {
      markets: {},
    })
    if (newMarkets.length > 0) {
      this.markets = newMarkets
    }
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

  setPrices = async () => {
    const result: Price[] = await this.queryClient.queryContractSmart(this.config.oracleAddress, {
      prices: {},
    })

    result.forEach((price: Price) => this.prices.set(price.denom, price.price))
  }

  refreshData = async () => {
    await this.setMarkets()
    await this.setBalances(this.config.liquidatorMasterAddress)
    await this.setPrices()
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
      const pagination = camelcaseKeys(responseJson.pagination as Pagination)

      // osmosis lcd query returns total pool count as 0 after page 1 (but returns the correct count on page 1), so we need to only set it once
      if (totalPoolCount === 0) {
        totalPoolCount = pagination.total
      }

      pools = pools.concat(camelcaseKeys(responseJson.pools as Pool[]))

      nextKey = `?pagination.key=${pagination.nextKey}`
      if (pools.length >= totalPoolCount) {
        fetchedAllPools = true
      }
    }

    return pools
  }
}
