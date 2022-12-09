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
import { DataResponse, Debt, fetchBatch } from './hive.js'
import { IRedisInterface, RedisInterface } from './redis.js'
import { SwapAmountInRoute } from 'osmojs/types/codegen/osmosis/gamm/v1beta1/tx.js'
import BigNumber from 'bignumber.js'
import { AMMRouter } from './amm_router.js'
import fetch from 'node-fetch'
import { Pool } from './types/Pool.js'
import { Long } from 'osmojs/types/codegen/helpers.js'


const PREFIX = process.env.PREFIX!
const RPC_ENDPOINT = process.env.RPC_ENDPOINT!
const LCD_ENDPOINT = process.env.LCD_ENDPOINT!
const HIVE_ENDPOINT = process.env.HIVE_ENDPOINT!
const LIQUIDATION_FILTERER_CONTRACT = process.env.LIQUIDATION_FILTERER_CONTRACT!
const LIQUIDATABLE_ASSETS: string[] = JSON.parse(process.env.LIQUIDATABLE_ASSETS!)
const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS!
const REDBANK_ADDRESS = process.env.REDBANK_ADDRESS!
const NEUTRAL_ASSET_DENOM = process.env.NEUTRAL_ASSET_DENOM!

const ROUTES: Routes = JSON.parse(process.env.ROUTES!)

const {
  swapExactAmountIn
} = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl;

const {
  executeContract,
} = cosmwasm.wasm.v1.MessageComposer.withTypeUrl;


interface Routes {
  // Route for given pair [debt:collateral]
  [pair: string]: SwapAmountInRoute[]
}

interface Price {
  price: number
  denom: string
}

interface Swaps {
  [key: string]: Coin
}

interface Collaterals {
  [key: string]: BigNumber
}

const addresses: ProtocolAddresses = {
  oracle: process.env.CONTRACT_ORACLE_ADDRESS as string,
  redBank: process.env.CONTRACT_REDBANK_ADDRESS as string,
  addressProvider: '',
  filterer: '',
  incentives: '',
  rewardsCollector: '',
}

const prices : Map<string, number> = new Map()
const balances: Map<string, number> = new Map()
let maxBorrow : BigNumber = new BigNumber(0)
let client : SigningStargateClient
let queryClient : CosmWasmClient

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
export class Executor {
  private sm : SecretManager
  private ammRouter : AMMRouter

  constructor(sm? : SecretManager) {
    this.sm = !sm ? getDefaultSecretManager() : sm
    this.ammRouter = new AMMRouter()
  }

  async initiate() : Promise<{
    redis: RedisInterface
    liquidationHelper: LiquidationHelper
  }> {
    const redis = new RedisInterface()
    await redis.connect()
  
    const seedPhrase = await this.sm.getSeedPhrase()
    const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(seedPhrase, { prefix: PREFIX })
  
    const pools = await loadPools()
    this.ammRouter.setPools(pools)

    //The liquidator account should always be the first under that seed, although we could set the index as a parameter in the .env
    const liquidatorAddress = (await liquidator.getAccounts())[0].address
    
    queryClient = await SigningCosmWasmClient.connectWithSigner(
      RPC_ENDPOINT,
      liquidator
    )
  
    client = await SigningStargateClient.connectWithSigner(RPC_ENDPOINT, liquidator)
  
    const executeTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract'
  
    client.registry.register(executeTypeUrl, MsgExecuteContract)
      
    const liquidationHelper = new LiquidationHelper(
      liquidatorAddress,
      LIQUIDATION_FILTERER_CONTRACT,
    )

    
  
    console.log('setting balances')
    await setBalances(queryClient, liquidatorAddress)
    
    // todo if gas is low, notify here

    await setPrices(queryClient)
    
    return {
      redis,
      liquidationHelper
    }
  }

  async start() {
    
    const {
      redis,
      liquidationHelper
    } = await this.initiate()

    // run
    while (true) await this.run(liquidationHelper, redis)
  }

  produceLiquidationTxs(positionData : DataResponse[], liquidationHelper: LiquidationHelper) : {
    txs: LiquidationTx[],
    debtsToRepay : Map<string, BigNumber>
  } {
    const txs: LiquidationTx[] = []
    const debtsToRepay = new Map<string, BigNumber>()
  
    let totalDebtValue = BigNumber(0)

    // create a list of debts that need to be liquidated
    positionData.forEach(async (positionResponse: DataResponse) => {
      const positionAddress = Object.keys(positionResponse.data)[0]
      const position = positionResponse.data[positionAddress]

      // create liquidate tx
      const liquidateTx = liquidationHelper.produceLiquidationTx(
        position.debts,
        position.collaterals,
        positionAddress,
      )

      const debtDenom = liquidateTx.debt_denom
      const amount: BigNumber = new BigNumber(
        position.debts.find((debt: Debt) => debt.denom === debtDenom)?.amount || 0,
      )

      const newDebt = totalDebtValue.plus(new BigNumber(amount.multipliedBy(prices.get(debtDenom)!)))
  
      // ensure we are well under max borrow
      if (maxBorrow > newDebt.multipliedBy(1.05)) {
        txs.push(liquidateTx)
        debtsToRepay.set(liquidateTx.debt_denom, newDebt) // todo is number here an issue?
        totalDebtValue = newDebt
      } else {
        console.log(
          `- WARNING: Cannot liquidate liquidatable position for ${liquidateTx.user_address} because we do not have enough available assets.`,
        )
        // todo notify?
      }
    })

    return {txs, debtsToRepay}
  }

  produceBorrowTxs(debtsToRepay : Map<string, BigNumber>, liquidationHelper : LiquidationHelper) : EncodeObject[] {
    const borrowTxs : EncodeObject[] = []
    debtsToRepay.forEach((amount, denom) => borrowTxs.push(
      makeBorrowMessage(
        liquidationHelper.getLiquidatorAddress(),
        denom,
        amount.toFixed(0),
        REDBANK_ADDRESS)))
    return borrowTxs
  }

  parseResults(results: LiquidationResult[]) : {
    collateralsWon : Map<string, Coin>,
    debtsRepaid: Map<string, Coin>
  } {
    const collateralsWon: Map<string, Coin> = new Map()
    const debtsRepaid : Map<string, Coin> = new Map()

    // withdraw all the collateral we recieved, calculate all the debt to repay
    for (const index in results) {
      const liquidation: LiquidationResult = results[index]
  
      // todo find route, and do swaps for those that liquidated
      const collateralRecievedDenom = liquidation.collateralReceivedDenom
      const debtDenom = liquidation.debtRepaidDenom
      const collateralWon = liquidation.collateralReceivedAmount
      const debtRepaid = liquidation.debtRepaidAmount

      const runningCountOfTotalWon = collateralsWon.has(collateralRecievedDenom) ? collateralsWon.get(collateralRecievedDenom)!.amount : 0
      const runningCountOfTotalRepaid = debtsRepaid.has(debtDenom) ? debtsRepaid.get(debtDenom)!.amount : 0

      collateralsWon.set(collateralRecievedDenom,  { denom: collateralRecievedDenom, amount : collateralWon + runningCountOfTotalWon })
      debtsRepaid.set(debtDenom, { denom: debtDenom, amount : debtRepaid + runningCountOfTotalRepaid })
    }

    return {collateralsWon, debtsRepaid}
  }

  appendWithdrawMessages(collateralsWon: Map<string, Coin>, liquidatorAddress:string, msgs: EncodeObject[]) {
      // for each asset, create a withdraw message
      Object.keys(collateralsWon).forEach((denom: string) =>
      msgs.push(executeContract(
        makeWithdrawMessage(liquidatorAddress, denom, addresses.redBank).value as MsgExecuteContract
      ))
    )

    return msgs
  }


  appendSwapToNeutralMessages(collateralsWon: Map<string, Coin>, liquidatorAddress: string, msgs: EncodeObject[]) {
    //Swap to neutral
    collateralsWon.forEach((collateral) => {
      const collateralAmount = new BigNumber(collateral.amount)
      const routeOptions = this.ammRouter.getRoutes(collateral.denom, NEUTRAL_ASSET_DENOM)
      
      const bestRoute = routeOptions.sort(
        (routeA, routeB) => {
          
          const routeAReturns = this.ammRouter.getEstimatedOutput(collateralAmount,routeA)
          const routeBReturns = this.ammRouter.getEstimatedOutput(collateralAmount,routeB)
          return routeAReturns.minus(routeBReturns).toNumber()
        }).pop()
      
        if (bestRoute) {
          msgs.push(
            swapExactAmountIn({
              sender:liquidatorAddress,
              // cast to long because osmosis felt it neccessary to create their own Long rather than use the js one
              routes:bestRoute?.map((route) => {return {poolId: route.poolId as Long, tokenOutDenom: NEUTRAL_ASSET_DENOM}}),
              tokenIn: collateral,
              // allow for 0.5%% slippage from what we estimated
              tokenOutMinAmount: this.ammRouter.getEstimatedOutput(new BigNumber(collateral.amount), bestRoute).multipliedBy(0.995).toFixed(0), 
            }))
        }
    })

    return msgs
  }

  appendSwapToDebtMessages(debtsRepaid: Map<string, Coin>, liquidatorAddress: string, msgs: EncodeObject[]) {
    debtsRepaid.forEach((debt) => {
      const debtAmount = new BigNumber(debt.amount)
      const routeOptions = this.ammRouter.getRoutes(NEUTRAL_ASSET_DENOM, debt.denom)
      
      const bestRoute = routeOptions.sort(
        (routeA, routeB) => {
          
          const routeAReturns = this.ammRouter.getEstimatedRequiredInput(debtAmount,routeA)
          const routeBReturns = this.ammRouter.getEstimatedRequiredInput(debtAmount,routeB)
          return routeAReturns.minus(routeBReturns).toNumber()
        }).pop()
      
        if (bestRoute) {
          // we swap a little more to ensure we do not get debt
          const bestRouteAmount = this.ammRouter.getEstimatedRequiredInput(debtAmount.multipliedBy(1.0075), bestRoute)
          msgs.push(
            swapExactAmountIn({
              sender:liquidatorAddress,
              // cast to long because osmosis felt it neccessary to create their own Long rather than use the js one
              routes:bestRoute?.map((route) => {return {poolId: route.poolId as Long, tokenOutDenom: NEUTRAL_ASSET_DENOM}}),
              tokenIn: {denom : NEUTRAL_ASSET_DENOM, amount: bestRouteAmount.toFixed(0)},
              // allow for 1% slippage for debt what we estimated
              tokenOutMinAmount: debtAmount.toFixed(0), 
            }))
        }
    })

    return msgs
  }

  appendRepayMessages(debtsToRepay: Map<string, BigNumber>, liquidatorAddress: string, msgs: EncodeObject[]) : EncodeObject[] {
    Object.keys(debtsToRepay).forEach((debtKey) => {
      msgs.push(makeRepayMessage(
        liquidatorAddress,
        debtKey,
        REDBANK_ADDRESS,
        [{
          denom:debtKey, 
          amount:debtsToRepay.get(debtKey)?.toFixed(0) || "0"}
        ]
      ))
    })

    return msgs
  }

  async appendDepositMessages(liquidatorAddress: string, msgs: EncodeObject[]) : Promise<EncodeObject[]> {
    const balance = await client.getBalance(liquidatorAddress, NEUTRAL_ASSET_DENOM)
    msgs.push(
      makeDepositMessage(
        liquidatorAddress,
        NEUTRAL_ASSET_DENOM,
        REDBANK_ADDRESS,
        [
          balance
        ]
      )
    )

    return msgs
  }

  async run(liquidationHelper: LiquidationHelper, redis: IRedisInterface) {

    // Find our limit we can borrow. Denominated in 
    maxBorrow = await getMaxBorrow(liquidationHelper.getLiquidatorAddress())

    console.log("Checking for liquidations")
    const positions: Position[] = await redis.fetchUnhealthyPositions()
    
    if (positions.length == 0) {
      //sleep to avoid spamming redis db when empty
      await sleep(200)
      console.log(' - No items for liquidation yet')
      return
    }
  
    // Fetch position data
    const positionData: DataResponse[] = await fetchBatch(positions, addresses.redBank, HIVE_ENDPOINT)
  
    console.log(`- found ${positionData.length} positions queued for liquidation.`)
    
    
    // fetch debts, liquidation txs
    const {txs, debtsToRepay } = this.produceLiquidationTxs(positionData, liquidationHelper)
    
    const debtCoins: Coin[] = []
    debtsToRepay.forEach((amount, denom) => debtCoins.push({ denom, amount: amount.toFixed(0) }))
  
    // produce borrow tx's
    const borrowTxs = this.produceBorrowTxs(debtsToRepay, liquidationHelper)

    // dispatch liquidation tx along with borrows, and recieve and object with results on it
    const results = await sendBorrowAndLiquidateTx(txs, borrowTxs, debtCoins, liquidationHelper)
  
    // Log the amount of liquidations executed
    redis.incrementBy('executor.liquidations.executed', results.length)
  
    const liquidatorAddress = liquidationHelper.getLiquidatorAddress()
  
    console.log(`- Successfully liquidated ${results.length} positions`)
      
    // Parse results and react accordingly
    const {collateralsWon, debtsRepaid} = this.parseResults(results)
  
    // second block of transactions
    let msgs : EncodeObject[] = []
    msgs = this.appendWithdrawMessages(collateralsWon, liquidatorAddress, msgs)
    msgs = this.appendSwapToNeutralMessages(collateralsWon, liquidatorAddress, msgs)
    msgs = this.appendSwapToDebtMessages(debtsRepaid, liquidatorAddress, msgs)
    msgs = this.appendRepayMessages(debtsToRepay, liquidatorAddress, msgs)

    // todo - maintain track of asset
    msgs = await this.appendDepositMessages(liquidatorAddress, msgs)

    await client.signAndBroadcast(
      liquidatorAddress,
      msgs,
      await getFee(msgs, liquidationHelper.getLiquidationFiltererContract())
    )
    
    console.log(`- Lquidation Process Complete.`)
  }
}

const getFee = async(msgs: EncodeObject[], address: string) => {
  const gasEstimated = await client.simulate(address, msgs, '');
  const fee = {
    amount: coins(0.01, 'uosmo'),
    gas: Number(gasEstimated*1.3).toString()
  }

  return fee
}

const sendBorrowAndLiquidateTx = async(txs: LiquidationTx[], borrowMessages: EncodeObject[], coins: Coin[], liquidationHelper : LiquidationHelper): Promise<LiquidationResult[]> => {
  const liquidateMsg = JSON.stringify({liquidate_many: {liquidations: txs}})

  const msg = toUtf8(liquidateMsg)

  const msgs: EncodeObject[] = borrowMessages

  msgs.push(
    executeContract(
      makeExecuteContractMessage(
        liquidationHelper.getLiquidatorAddress(), 
        liquidationHelper.getLiquidationFiltererContract(), 
        msg,
        coins).value as MsgExecuteContract
  ))

  if (!msgs || msgs.length === 0) return []

  const result = await client.signAndBroadcast(
    liquidationHelper.getLiquidatorAddress(),
    msgs,
    await getFee(msgs,liquidationHelper.getLiquidationFiltererContract())
  )

  if (!result || !result.rawLog) return []
  const events = JSON.parse(result.rawLog)[0]
  
  return liquidationHelper.parseLiquidationResult(events.events)
}

const setBalances = async (client: CosmWasmClient, liquidatorAddress: string) => {
  for (const denom in LIQUIDATABLE_ASSETS) {

    const balance = await client.getBalance(liquidatorAddress, LIQUIDATABLE_ASSETS[denom])

    console.log({
      balance,
      liquidatorAddress
    })
    balances.set(LIQUIDATABLE_ASSETS[denom], Number(balance.amount))
  }
}

const setPrices = async (client: CosmWasmClient) => {

  const result : Price[]= await client.queryContractSmart(ORACLE_ADDRESS, {
    prices: {},
  })
  
  result.forEach((price: Price) => prices.set(price.denom, price.price))
}

const getMaxBorrow = async( liquidatorAddress : string) : Promise<BigNumber> => {
  const result = await queryClient.queryContractSmart(REDBANK_ADDRESS, {
    user_position: { user_addr: liquidatorAddress },
  })

  return new BigNumber(result.weighted_max_ltv_collateral)
}

const loadPools = async() : Promise<Pool[]> => {
  const response = await fetch(`${LCD_ENDPOINT}/osmosis/gamm/v1beta1/pools`)
  const pools : Pool[] = await response.json() as Pool[]
  return pools
}