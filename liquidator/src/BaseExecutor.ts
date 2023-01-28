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

const PREFIX = process.env.PREFIX! as string
const RPC_ENDPOINT = process.env.RPC_ENDPOINT! as string
const LCD_ENDPOINT = process.env.LCD_ENDPOINT! as string

const LIQUIDATION_FILTERER_CONTRACT = process.env.LIQUIDATION_FILTERER_CONTRACT! as string
const LIQUIDATABLE_ASSETS: string[] = JSON.parse(process.env.LIQUIDATABLE_ASSETS!)
const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS! as string
const REDBANK_ADDRESS = process.env.REDBANK_ADDRESS! as string

interface Price {
  price: number
  denom: string
}

const getDefaultSecretManager = (): SecretManager => {
  return {
    getSeedPhrase: async () => {
      const seed = process.env.SEED
      if (!seed)
        throw Error(
          'Failed to find SEED environment variable. Add your seed phrase to the SEED environment variable or implement a secret manager instance',
        )

      return seed
    },
  }
}

/**
 * Executor class is the entry point for the executor service
 *
 * @param sm An optional parameter. If you want to use a secret manager to hold the seed
 *           phrase, implement the secret manager interface and pass as a dependency.
 */
export class BaseExecutor {
  public sm: SecretManager
  public ammRouter: AMMRouter
  public redis: RedisInterface
  public prices: Map<string, number> = new Map()
  public balances: Map<string, number> = new Map()

  private client: SigningStargateClient | undefined = undefined
  private queryClient: CosmWasmClient | undefined = undefined

  constructor(sm?: SecretManager) {
    this.sm = !sm ? getDefaultSecretManager() : sm
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

    const seedPhrase = await this.sm.getSeedPhrase()
    const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(seedPhrase, { prefix: PREFIX })

    const pools = await this.loadPools()
    this.ammRouter.setPools(pools)

    //The liquidator account should always be the first under that seed, although we could set the index as a parameter in the .env
    const liquidatorAddress = (await liquidator.getAccounts())[0].address

    this.queryClient = await SigningCosmWasmClient.connectWithSigner(RPC_ENDPOINT, liquidator)

    this.client = await SigningStargateClient.connectWithSigner(RPC_ENDPOINT, liquidator)

    const executeTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract'

    this.client.registry.register(executeTypeUrl, MsgExecuteContract)

    const liquidationHelper = new LiquidationHelper(
      liquidatorAddress,
      LIQUIDATION_FILTERER_CONTRACT,
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
    for (const denom in LIQUIDATABLE_ASSETS) {
      const balance = await this.getWasmQueryClient().getBalance(liquidatorAddress, LIQUIDATABLE_ASSETS[denom])
      this.balances.set(LIQUIDATABLE_ASSETS[denom], Number(balance.amount))
    }
  }

  setPrices = async () => {
    const result: Price[] = await this.getWasmQueryClient().queryContractSmart(ORACLE_ADDRESS, {
      prices: {},
    })

    result.forEach((price: Price) => this.prices.set(price.denom, price.price))
  }

  getMaxBorrow = async (liquidatorAddress: string): Promise<BigNumber> => {
    const result = await this.getWasmQueryClient().queryContractSmart(REDBANK_ADDRESS, {
      user_position: { user_addr: liquidatorAddress },
    })

    return new BigNumber(result.weighted_max_ltv_collateral)
  }

  loadPools = async (): Promise<Pool[]> => {
    const response = await fetch(`${LCD_ENDPOINT}/osmosis/gamm/v1beta1/pools`)
    const pools: Pool[] = (await response.json()) as Pool[]
    return pools
  }
  
  getFee = async(msgs: EncodeObject[], address: string) => {
    const gasEstimated = await this.getSigningClient().simulate(address, msgs, '');
    const fee = {
      amount: coins(0.01, 'uosmo'),
      gas: Number(gasEstimated*1.3).toString()
    }
  
    return fee
  }
}
