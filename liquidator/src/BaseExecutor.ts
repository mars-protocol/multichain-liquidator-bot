import { LiquidationHelper } from './liquidation_helpers.js'
import { SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { coins, DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { RedisInterface } from './redis.js'
import BigNumber from 'bignumber.js'
import { AMMRouter } from './amm_router.js'
import fetch from 'node-fetch'
import { Pool } from './types/Pool.js'
import 'dotenv/config.js'

interface Price {
  price: number
  denom: string
}

interface ExecutorConfig {
  prefix: string
  rpcEndpoint: string
  lcdEndpoint: string
  hiveEndpoint: string
  contracts : {
    liquidationFilterer: string
    oracle: string
    redbank: string
  }
  mnemonic: string
  liquidatableAssets: string[]
  gasDenom: string
  neutralAssetDenom: string
}

/**
 * Executor class is the entry point for the executor service
 *
 * @param config holds the neccessary configuration for the executor to operate
 */
export class BaseExecutor {
  public ammRouter: AMMRouter
  public redis: RedisInterface
  public prices: Map<string, number> = new Map()
  public balances: Map<string, number> = new Map()
  public config: ExecutorConfig

  private client: SigningStargateClient | undefined = undefined
  private queryClient: CosmWasmClient | undefined = undefined

  constructor(config: ExecutorConfig) {
    this.config = config
    this.ammRouter = new AMMRouter()
    this.redis = new RedisInterface()
  }

  getSigningClient = () : SigningStargateClient => {
    if (!this.client) throw Error("Client not initialsed. Call initiate() to initiate clients")
    return this.client!
  }

  getWasmQueryClient = () : CosmWasmClient => {
    if (!this.queryClient) throw Error("Client not initialsed. Call initiate() to initiate clients")
    return this.queryClient!
  }

  async initiate(): Promise<{
    redis: RedisInterface
    liquidationHelper: LiquidationHelper
  }> {
    await this.redis.connect()

    const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(this.config.mnemonic, { prefix: this.config.prefix })

    const pools = await this.loadPools()
    this.ammRouter.setPools(pools)

    //The liquidator account should always be the first under that seed, although we could set the index as a parameter in the .env
    const liquidatorAddress = (await liquidator.getAccounts())[0].address

    this.queryClient = await SigningCosmWasmClient.connectWithSigner(this.config.rpcEndpoint, liquidator)

    this.client = await SigningStargateClient.connectWithSigner(this.config.rpcEndpoint, liquidator)

    const executeTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract'

    this.client.registry.register(executeTypeUrl, MsgExecuteContract)

    const liquidationHelper = new LiquidationHelper(
      liquidatorAddress,
      this.config.contracts.liquidationFilterer,
    )

    await this.setBalances(liquidatorAddress)

    // todo if gas is low, notify here

    await this.setPrices()

    return {
      redis: this.redis,
      liquidationHelper,
    }
  }

  setBalances = async (liquidatorAddress: string) => {
    for (const denom in this.config.liquidatableAssets) {
      const balance = await this.getWasmQueryClient().getBalance(liquidatorAddress, this.config.liquidatableAssets[denom])
      this.balances.set(this.config.liquidatableAssets[denom], Number(balance.amount))
    }
  }

  setPrices = async () => {
    const result: Price[] = await this.getWasmQueryClient().queryContractSmart(this.config.contracts.oracle, {
      prices: {},
    })

    result.forEach((price: Price) => this.prices.set(price.denom, price.price))
  }

  getMaxBorrow = async (liquidatorAddress: string): Promise<BigNumber> => {
    const result = await this.getWasmQueryClient().queryContractSmart(this.config.contracts.redbank, {
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
    const gasEstimated = await this.getSigningClient().simulate(address, msgs, '');
    const fee = {
      amount: coins(0.01, this.config.gasDenom),
      gas: Number(gasEstimated*1.3).toString()
    }
  
    return fee
  }
}
