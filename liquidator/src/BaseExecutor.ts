import { LiquidationHelper } from './liquidation_helpers.js'

import { LiquidationResult, LiquidationTx } from './types/liquidation.js'
import { Position } from './types/position'
import { toUtf8 } from '@cosmjs/encoding'
import { AminoTypes, Coin, SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import {
  coins,
  DirectSecp256k1HdWallet,
  EncodeObject,
  GeneratedType,
  Registry,
} from '@cosmjs/proto-signing'
import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import camelcaseKeys from 'camelcase-keys'

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
import { MsgSwapExactAmountIn } from 'osmojs/types/codegen/osmosis/gamm/v1beta1/tx.js'
import BigNumber from 'bignumber.js'
import { AMMRouter } from './amm_router.js'
import fetch from 'node-fetch'
import { Pagination, Pool } from './types/Pool.js'
const { swapExactAmountIn } = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl

import {
  cosmosAminoConverters,
  cosmosProtoRegistry,
  cosmwasmAminoConverters,
  cosmwasmProtoRegistry,
  ibcProtoRegistry,
  ibcAminoConverters,
  osmosisAminoConverters,
  osmosisProtoRegistry,
} from 'osmojs'
import { MarketInfo } from './rover/types/MarketInfo.js'
import { CSVWriter, Row } from './CsvWriter.js'

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
  public client: SigningStargateClient | undefined = undefined
  public queryClient: CosmWasmClient | undefined = undefined
  private redbankMarkets: Map<string, MarketInfo> = new Map()
  // used to log tests
  private csvLogger = new CSVWriter(
    './results.csv',
    [
      {id: 'blockHeight', title: 'BlockHeight'},
      {id: 'userAddress', title: 'User'},
      {id: 'estimatedLtv', title: 'LiquidationLtv'},
      {id: 'debtRepaid', title: 'debtRepaid'},
      {id: 'collateral', title: 'collateral'},
      {id: 'liquidatorBalance', title: 'liquidatorBalance' }
    ]
  )
  constructor(sm?: SecretManager) {
    this.sm = !sm ? getDefaultSecretManager() : sm
    this.ammRouter = new AMMRouter()
    this.redis = new RedisInterface()
  }

  async initiate(): Promise<{
    redis: RedisInterface
    liquidationHelper: LiquidationHelper
  }> {
    await this.redis.connect()

    const seedPhrase = await this.sm.getSeedPhrase()
    const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(seedPhrase, { prefix: PREFIX })

    await this.refreshPools()    

    //The liquidator account should always be the first under that seed, although we could set the index as a parameter in the .env
    const liquidatorAddress = (await liquidator.getAccounts())[0].address

    const protoRegistry: ReadonlyArray<[string, GeneratedType]> = [
      ...cosmosProtoRegistry,
      ...cosmwasmProtoRegistry,
      ...ibcProtoRegistry,
      ...osmosisProtoRegistry,
    ]

    const aminoConverters = {
      ...cosmosAminoConverters,
      ...cosmwasmAminoConverters,
      ...ibcAminoConverters,
      ...osmosisAminoConverters,
    }

    const registry = new Registry(protoRegistry)
    const aminoTypes = new AminoTypes(aminoConverters)
    this.queryClient = await SigningCosmWasmClient.connectWithSigner(RPC_ENDPOINT, liquidator)

    this.client = await SigningStargateClient.connectWithSigner(RPC_ENDPOINT, liquidator, {
      registry,
      aminoTypes,
    })

    const executeTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract'

    this.client.registry.register(executeTypeUrl, MsgExecuteContract)

    const liquidationHelper = new LiquidationHelper(
      liquidatorAddress,
      LIQUIDATION_FILTERER_CONTRACT,
    )

    console.log('setting balances')
    await this.setBalances(liquidatorAddress)

    // todo if gas is low, notify here

    await this.setPrices(this.queryClient)

    return {
      redis: this.redis,
      liquidationHelper,
    }
  }

  addCsvRow = (row : Row) => {
    this.csvLogger.addRow(row)
  }

  writeCsv = async() => {
    await this.csvLogger.writeToFile()
  }

  refreshPools = async () => {
    const pools = await this.loadPools()
    this.ammRouter.setPools(pools)
  }


  getMaxBorrow = async (liquidatorAddress: string): Promise<BigNumber> => {
    if (!this.queryClient)
      throw new Error('Client is null, call initiate() before using this class')
    const result = await this.queryClient.queryContractSmart(REDBANK_ADDRESS, {
      user_position: { user: liquidatorAddress },
    })

    return new BigNumber(result.weighted_max_ltv_collateral).minus(result.total_collateralized_debt)
  }

  setBalances = async (liquidatorAddress: string) => {
    if (!this.queryClient) {
      console.warn('Cannot set prices, query client has not been initialised.')
      return
    }

    for (const denom in LIQUIDATABLE_ASSETS) {
      const balance = await this.queryClient.getBalance(
        liquidatorAddress,
        LIQUIDATABLE_ASSETS[denom],
      )

      console.log({
        balance,
        liquidatorAddress,
      })
      this.balances.set(LIQUIDATABLE_ASSETS[denom], Number(balance.amount))
    }
  }

  setPrices = async (client: CosmWasmClient) => {
    const result: Price[] = await client.queryContractSmart(ORACLE_ADDRESS, {
      prices: {},
    })

    result.forEach((price: Price) => this.prices.set(price.denom, price.price))
  }

  loadPools = async (): Promise<Pool[]> => {
    let fetchedAllPools = false
    let nextKey = ''
    let pools : Pool[] = []
    let totalPoolCount = 0
    while (!fetchedAllPools) {
      const response = await fetch(`${LCD_ENDPOINT}/osmosis/gamm/v1beta1/pools${nextKey}`)
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
