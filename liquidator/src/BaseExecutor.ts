import { LiquidationHelper } from './liquidation_helpers.js'

import { LiquidationResult, LiquidationTx } from './types/liquidation.js'
import { Position } from './types/position'
import { toUtf8 } from '@cosmjs/encoding'
import { Coin, SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { coins, DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import {
  makeBorrowMessage,
  makeDepositMessage,
  makeExecuteContractMessage,
  makeRepayMessage,
  makeWithdrawMessage,
  ProtocolAddresses,
  sleep,
} from './helpers.js'
import { osmosis, cosmwasm } from 'osmojs'

import 'dotenv/config.js'
import { DataResponse, Debt, fetchRedbankBatch } from './hive.js'
import { IRedisInterface, RedisInterface } from './redis.js'
import { SwapAmountInRoute } from 'osmojs/types/codegen/osmosis/gamm/v1beta1/tx.js'
import BigNumber from 'bignumber.js'
import { AMMRouter } from './amm_router.js'
import fetch from 'node-fetch'
import { Pool } from './types/Pool.js'


const PREFIX = process.env.PREFIX!
const RPC_ENDPOINT = process.env.RPC_ENDPOINT!
const LCD_ENDPOINT = process.env.LCD_ENDPOINT!
const HIVE_ENDPOINT = process.env.HIVE_ENDPOINT!
const LIQUIDATION_FILTERER_CONTRACT = process.env.LIQUIDATION_FILTERER_CONTRACT!
const LIQUIDATABLE_ASSETS: string[] = JSON.parse(process.env.LIQUIDATABLE_ASSETS!)
const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS!
const REDBANK_ADDRESS = process.env.REDBANK_ADDRESS!

interface Price {
  price: number
  denom: string
}

const getDefaultSecretManager = (): SecretManager => {
  return {
    getSeedPhrase: async () => {
      
      const seed = process.env.SEED
      if (!seed) 
        throw Error("Failed to find SEED environment variable. Add your seed phrase to the SEED environment variable or implement a secret manager instance")

      return seed
    }
  }
}

/**
 * Executor class is the entry point for the executor service
 * 
 * @param sm An optional parameter. If you want to use a secret manager to hold the seed 
 *           phrase, implement the secret manager interface and pass as a dependency.
 */
export class BaseExecutor {
    public sm : SecretManager
    public ammRouter : AMMRouter
    public redis : RedisInterface
    public prices : Map<string, number> = new Map()
    public balances: Map<string, number> = new Map()
    public client : SigningStargateClient | undefined = undefined
    public queryClient : CosmWasmClient | undefined = undefined
    constructor(sm? : SecretManager) {
        this.sm = !sm ? getDefaultSecretManager() : sm
        this.ammRouter = new AMMRouter()
        this.redis = new RedisInterface()
    }

  async initiate() : Promise<{
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
    
    this.queryClient = await SigningCosmWasmClient.connectWithSigner(
      RPC_ENDPOINT,
      liquidator
    )
  
    this.client = await SigningStargateClient.connectWithSigner(RPC_ENDPOINT, liquidator)
  
    const executeTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract'
  
    this.client.registry.register(executeTypeUrl, MsgExecuteContract)
      
    const liquidationHelper = new LiquidationHelper(
      liquidatorAddress,
      LIQUIDATION_FILTERER_CONTRACT,
    )
  
    console.log('setting balances')
    await this.setBalances(this.queryClient, liquidatorAddress)
    
    // set up liquidator pools

    // todo if gas is low, notify here

    await this.setPrices(this.queryClient)
    
    return {
      redis: this.redis,
      liquidationHelper
    }
  }

  getMaxBorrow = async( liquidatorAddress : string) : Promise<BigNumber> => {
    if (!this.queryClient) throw new Error("Client is null, call initiate() before using this class")
    console.log({REDBANK_ADDRESS, liquidatorAddress})
    const result = await this.queryClient.queryContractSmart(REDBANK_ADDRESS, {
      user_position: { user: liquidatorAddress },
    })
  
    return new BigNumber(result.weighted_max_ltv_collateral)
  }

  setBalances = async (client: CosmWasmClient, liquidatorAddress: string) => {
    for (const denom in LIQUIDATABLE_ASSETS) {
  
      const balance = await client.getBalance(liquidatorAddress, LIQUIDATABLE_ASSETS[denom])
  
      console.log({
        balance,
        liquidatorAddress
      })
      this.balances.set(LIQUIDATABLE_ASSETS[denom], Number(balance.amount))
    }
  }
  
setPrices = async (client: CosmWasmClient) => {
  
    const result : Price[]= await client.queryContractSmart(ORACLE_ADDRESS, {
      prices: {},
    })
    
    result.forEach((price: Price) => this.prices.set(price.denom, price.price))
  }
  


loadPools = async() : Promise<Pool[]> => {
    const response = await fetch(`${LCD_ENDPOINT}/osmosis/gamm/v1beta1/pools`)
    const pools : Pool[] = await response.json() as Pool[]
    return pools
  }

}