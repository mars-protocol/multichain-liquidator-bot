import { LiquidationHelper } from './liquidation_helpers.js'
import { SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { Coin, coins, DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { RedisInterface } from './redis.js'
import BigNumber from 'bignumber.js'
import { AMMRouter } from './amm_router.js'
import fetch from 'node-fetch'
import { Pool } from './types/Pool.js'
import 'dotenv/config.js'
import { MarketInfo } from './rover/types/MarketInfo.js'
import { RedbankExecutorConfig } from './redbank/executor.js'
import { RoverExecutorConfig } from './rover/executor.js'

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
  public markets : MarketInfo[] = []
  public config: BaseExecutorConfig

  public client: SigningStargateClient 
  public queryClient: CosmWasmClient 

  constructor(config: BaseExecutorConfig, client: SigningStargateClient, queryClient: CosmWasmClient) {
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

  setMarkets = async() => {
    const newMarkets = await this.queryClient.queryContractSmart(this.config.redbankAddress, {markets: {}})
    if (newMarkets.length > 0) {
      this.markets = newMarkets
    }
  }

  setBalances = async (liquidatorAddress: string) => {

    const coinBalances : readonly Coin[] = await this.client.getAllBalances(liquidatorAddress)
    for (const index in coinBalances) {
      const coin = coinBalances[index]
      this.balances.set(coin.denom, Number(coin.amount))
    }
  }

  setPrices = async () => {
    const result: Price[] = await this.queryClient.queryContractSmart(this.config.oracleAddress, {
      prices: {},
    })

    result.forEach((price: Price) => this.prices.set(price.denom, price.price))
  }

  getMaxBorrow = async (liquidatorAddress: string): Promise<BigNumber> => {
    const result = await this.queryClient.queryContractSmart(this.config.redbankAddress, {
      user_position: { user_addr: liquidatorAddress },
    })

    return new BigNumber(result.weighted_max_ltv_collateral)
  }

  loadPools = async (): Promise<Pool[]> => {
    const response = await fetch(`${this.config.lcdEndpoint}/osmosis/gamm/v1beta1/pools`)
    const pools: Pool[] = (await response.json()) as Pool[]
    return pools
  }
  
  getFee = async(msgs: EncodeObject[], address: string) => {
    const gasEstimated = await this.client.simulate(address, msgs, '');
    const fee = {
      amount: coins(0.01, this.config.gasDenom),
      gas: Number(gasEstimated*1.3).toString()
    }
  
    return fee
  }
}
