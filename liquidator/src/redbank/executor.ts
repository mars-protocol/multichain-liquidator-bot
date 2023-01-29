import { LiquidationHelper } from '../liquidation_helpers.js'

import { LiquidationResult, LiquidationTx } from '../types/liquidation.js'
import { Position } from '../types/position'
import { toUtf8 } from '@cosmjs/encoding'
import { Coin, SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { coins, DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'

import {
  makeBorrowMessage,
  makeDepositMessage,
  makeExecuteContractMessage,
  makeRepayMessage,
  makeWithdrawMessage,
  ProtocolAddresses,
  sleep,
} from '../helpers.js'
import { osmosis, cosmwasm } from 'osmojs'

import 'dotenv/config.js'
import { DataResponse, Debt, fetchRedbankBatch } from '../hive.js'
import { IRedisInterface, RedisInterface } from '../redis.js'
import { SwapAmountInRoute } from 'osmojs/types/codegen/osmosis/gamm/v1beta1/tx.js'
import BigNumber from 'bignumber.js'
import { Long } from 'osmojs/types/codegen/helpers.js'
import { BaseExecutor, BaseExecutorConfig } from '../BaseExecutor.js'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'

const {
  swapExactAmountIn
} = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl;

const {
  executeContract,
} = cosmwasm.wasm.v1.MessageComposer.withTypeUrl;

let maxBorrow : BigNumber = new BigNumber(0)

export interface RedbankExecutorConfig extends BaseExecutorConfig {
  liquidationFiltererAddress: string
  liquidatableAssets: string[]
}

export class Executor extends BaseExecutor{

  public config : RedbankExecutorConfig
  private liquidationHelper: LiquidationHelper

  constructor(config : RedbankExecutorConfig, client: SigningStargateClient, queryClient: CosmWasmClient) {
    super(config, client, queryClient)
    this.config = config
    
    // instantiate liquidation helper
    this.liquidationHelper = new LiquidationHelper(
      this.config.liquidatorMasterAddress,
      this.config.liquidationFiltererAddress,
    )
  }


  async start() {
    
    await this.initiate()

    // run
    while (true) await this.run()
  }

  async run() {

    // Find our limit we can borrow. Denominated in 
    maxBorrow = await this.getMaxBorrow(this.liquidationHelper.getLiquidatorAddress())

    console.log("Checking for liquidations")
    const positions: Position[] = await this.redis.popUnhealthyPositions()
    
    if (positions.length == 0) {
      //sleep to avoid spamming redis db when empty
      await sleep(200)
      console.log(' - No items for liquidation yet')
      return
    }
  
    // Fetch position data
    const positionData: DataResponse[] = await fetchRedbankBatch(positions, this.config.redbankAddress, this.config.hiveEndpoint)
  
    console.log(`- found ${positionData.length} positions queued for liquidation.`)
    
    
    // fetch debts, liquidation txs
    const {txs, debtsToRepay } = this.produceLiquidationTxs(positionData, this.liquidationHelper)
    
    const debtCoins: Coin[] = []
    debtsToRepay.forEach((amount, denom) => debtCoins.push({ denom, amount: amount.toFixed(0) }))
  
    // produce borrow tx's
    const borrowTxs = this.produceBorrowTxs(debtsToRepay, this.liquidationHelper)

    // dispatch liquidation tx along with borrows, and recieve and object with results on it
    const results = await this.sendBorrowAndLiquidateTx(txs, borrowTxs, debtCoins, this.liquidationHelper)
  
    // Log the amount of liquidations executed
    this.redis.incrementBy('executor.liquidations.executed', results.length)
  
    const liquidatorAddress = this.liquidationHelper.getLiquidatorAddress()
  
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

    await this.client.signAndBroadcast(
      liquidatorAddress,
      msgs,
      await this.getFee(msgs, this.liquidationHelper.getLiquidationFiltererContract())
    )
    
    console.log(`- Lquidation Process Complete.`)
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

      const newDebt = totalDebtValue.plus(new BigNumber(amount.multipliedBy(this.prices.get(debtDenom)!)))
  
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
        this.config.redbankAddress)))
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
        makeWithdrawMessage(liquidatorAddress, denom, this.config.redbankAddress).value as MsgExecuteContract
      ))
    )

    return msgs
  }


  appendSwapToNeutralMessages(collateralsWon: Map<string, Coin>, liquidatorAddress: string, msgs: EncodeObject[]) {
    //Swap to neutral
    collateralsWon.forEach((collateral) => {
      const collateralAmount = new BigNumber(collateral.amount)
      const routeOptions = this.ammRouter.getRoutes(collateral.denom, this.config.neutralAssetDenom)
      
      const bestRoute = routeOptions.sort(
        (routeA, routeB) => {
          
          const routeAReturns = this.ammRouter.getOutput(collateralAmount,routeA)
          const routeBReturns = this.ammRouter.getOutput(collateralAmount,routeB)
          return routeAReturns.minus(routeBReturns).toNumber()
        }).pop()
      
      if (bestRoute) {
        msgs.push(
          swapExactAmountIn({
            sender:liquidatorAddress,
            // cast to long because osmosis felt it neccessary to create their own Long rather than use the js one
            routes:bestRoute?.map((route) => {return {poolId: route.poolId as Long, tokenOutDenom: this.config.neutralAssetDenom}}),
            tokenIn: collateral,
            // allow for 0.5%% slippage from what we estimated
            tokenOutMinAmount: this.ammRouter.getOutput(new BigNumber(collateral.amount), bestRoute).multipliedBy(0.995).toFixed(0), 
          }))
        }
    })

    return msgs
  }

  appendSwapToDebtMessages(debtsRepaid: Map<string, Coin>, liquidatorAddress: string, msgs: EncodeObject[]) {
    debtsRepaid.forEach((debt) => {
      const debtAmount = new BigNumber(debt.amount)
      const routeOptions = this.ammRouter.getRoutes(this.config.neutralAssetDenom, debt.denom)
      
      const bestRoute = routeOptions.sort(
        (routeA, routeB) => {
          
          const routeAReturns = this.ammRouter.getRequiredInput(debtAmount,routeA)
          const routeBReturns = this.ammRouter.getRequiredInput(debtAmount,routeB)
          return routeAReturns.minus(routeBReturns).toNumber()
        }).pop()
      
        if (bestRoute) {
          // we swap a little more to ensure we do not get debt
          const bestRouteAmount = this.ammRouter.getRequiredInput(debtAmount.multipliedBy(1.0075), bestRoute)
          msgs.push(
            swapExactAmountIn({
              sender:liquidatorAddress,
              // cast to long because osmosis felt it neccessary to create their own Long rather than use the js one
              routes:bestRoute?.map((route) => {return {poolId: route.poolId as Long, tokenOutDenom: this.config.neutralAssetDenom}}),
              tokenIn: {denom : this.config.neutralAssetDenom, amount: bestRouteAmount.toFixed(0)},
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
        this.config.redbankAddress,
        [{
          denom:debtKey, 
          amount:debtsToRepay.get(debtKey)?.toFixed(0) || "0"}
        ]
      ))
    })

    return msgs
  }

  async appendDepositMessages(liquidatorAddress: string, msgs: EncodeObject[]) : Promise<EncodeObject[]> {
    const balance = await this.queryClient.getBalance(liquidatorAddress, this.config.neutralAssetDenom)
    msgs.push(
      makeDepositMessage(
        liquidatorAddress,
        this.config.neutralAssetDenom,
        this.config.redbankAddress,
        [
          balance
        ]
      )
    )

    return msgs
  }

  sendBorrowAndLiquidateTx = async(
    txs: LiquidationTx[], 
    borrowMessages: EncodeObject[], 
    coins: Coin[], 
    liquidationHelper : LiquidationHelper): Promise<LiquidationResult[]> => {
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
  
    const result = await this.client.signAndBroadcast(
      liquidationHelper.getLiquidatorAddress(),
      msgs,
      await this.getFee(msgs,liquidationHelper.getLiquidationFiltererContract())
    )
  
    if (!result || !result.rawLog) return []
    const events = JSON.parse(result.rawLog)[0]
    
    return liquidationHelper.parseLiquidationResult(events.events)
  }
}