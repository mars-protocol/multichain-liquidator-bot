import { LiquidationHelper } from '../liquidation_helpers.js'

import { LiquidationResult, LiquidationTx } from '../types/liquidation.js'
import { Position } from '../types/position'
import { toUtf8 } from '@cosmjs/encoding'
import { Coin, SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { coins, EncodeObject } from '@cosmjs/proto-signing'
import {
  makeBorrowMessage,
  makeDepositMessage,
  makeExecuteContractMessage,
  makeRepayMessage,
  makeWithdrawMessage,
  ProtocolAddresses,
  repay,
  sleep,
} from '../helpers.js'
import { osmosis, cosmwasm } from 'osmojs'

import 'dotenv/config.js'
import { DataResponse, Debt, fetchRedbankBatch } from '../hive.js'
import { IRedisInterface, RedisInterface } from '../redis.js'

import BigNumber from 'bignumber.js'
import { Long } from 'osmojs/types/codegen/helpers.js'
import { BaseExecutor } from '../BaseExecutor.js'
import { Collateral } from '../rover/types/RoverPosition.js'
import { MarketInfo } from '../rover/types/MarketInfo.js'
import { getLargestCollateral, getLargestDebt } from '../liquidation_generator.js'
import { Row } from '../CsvWriter.js'

const HIVE_ENDPOINT = process.env.HIVE_ENDPOINT!
const REDBANK_ADDRESS = process.env.REDBANK_ADDRESS!
const NEUTRAL_ASSET_DENOM = process.env.NEUTRAL_ASSET_DENOM!
const GAS_TOKEN = process.env.GAS_TOKEN!

const { swapExactAmountIn } = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl

const { executeContract } = cosmwasm.wasm.v1.MessageComposer.withTypeUrl

const addresses: ProtocolAddresses = {
  oracle: process.env.ORACLE_ADDRESS as string,
  redBank: process.env.REDBANK_ADDRESS as string,
  addressProvider: '',
  filterer: process.env.LIQUIDATION_FILTERER_CONTRACT as string,
  incentives: '',
  rewardsCollector: '',
}

let maxBorrow: BigNumber = new BigNumber(0)

/**
 * Executor class is the entry point for the executor service
 *
 * @param sm An optional parameter. If you want to use a secret manager to hold the seed
 *           phrase, implement the secret manager interface and pass as a dependency.
 */
export class Executor extends BaseExecutor {
  
  async start() {
    const { redis, liquidationHelper } = await this.initiate()


    // run
    while (true) {
      try {
        await this.run(liquidationHelper, redis)
      } catch (e) {
        console.log('ERROR:', e)
      }
    }
  }

  async initiate(): Promise<{ redis: RedisInterface; liquidationHelper: LiquidationHelper }> {
    const { redis, liquidationHelper } = await super.initiate()

    // Deposit all stable denom into redbank
    const neutralBalance = this.balances.get(NEUTRAL_ASSET_DENOM) || 0
    if (neutralBalance > 0) {
      const depositCoin = { denom: NEUTRAL_ASSET_DENOM, amount: neutralBalance.toFixed(0) }

      const deposit = [
        makeDepositMessage(
          liquidationHelper.getLiquidatorAddress(),
          NEUTRAL_ASSET_DENOM,
          addresses.redBank,
          [depositCoin],
        ),
      ]
      await this.client?.signAndBroadcast(
        liquidationHelper.getLiquidatorAddress(),
        deposit,
        await this.getFee(deposit, liquidationHelper.getLiquidatorAddress()),
      )
    }

    return { redis, liquidationHelper }
  }

  produceLiquidationTxs(
    positionData: DataResponse[]
  ): {
    txs: LiquidationTx[]
    debtsToRepay: Map<string, BigNumber>
  } {
    const txs: LiquidationTx[] = []
    const debtsToRepay = new Map<string, BigNumber>()

    let totalDebtValue = BigNumber(0)


    // create a list of debts that need to be liquidated
    positionData.forEach(async (positionResponse: DataResponse) => {
      const positionAddress = Object.keys(positionResponse.data)[0]
      const position = positionResponse.data[positionAddress]

      if (position.collaterals.length > 0 && position.debts.length > 0) {

        const largestCollateralDenom = getLargestCollateral(position.collaterals, this.prices)
        const largestDebt = getLargestDebt(position.debts, this.prices)

        // total debt value is calculated in base denom (i.e uosmo)
        const remainingAvailableSize = maxBorrow.multipliedBy(0.85).minus(totalDebtValue)
        
        if (remainingAvailableSize.isGreaterThan(100)) {

          // we will always have a value here as we filter for the largest above
          const debtPrice = this.prices.get(largestDebt.denom)!

          const debtValue = new BigNumber(largestDebt.amount).multipliedBy(debtPrice)

          // Note -amount here is the number of the asset, not the value !
          const amountToLiquidate = remainingAvailableSize.isGreaterThan(debtValue) ? largestDebt.amount : remainingAvailableSize.dividedBy(debtPrice).toFixed(0)
          
          const liquidateTx = {
            collateral_denom: largestCollateralDenom,
            debt_denom: largestDebt.denom,
            user_address: positionAddress,
            amount: amountToLiquidate,
          }

          

          const newTotalDebt = totalDebtValue.plus(new BigNumber(amountToLiquidate).multipliedBy(debtPrice))
          txs.push(liquidateTx)

          // update debts + totals
          const existingDebt = debtsToRepay.get(liquidateTx.debt_denom) || 0
          debtsToRepay.set(liquidateTx.debt_denom, new BigNumber(amountToLiquidate).plus(existingDebt))
          totalDebtValue = newTotalDebt
        } else {
          console.warn(
            `WARNING - not enough size to liquidate this position - user address : ${[positionAddress]}`
          )
        }
      }
    })

    return { txs, debtsToRepay }
  }

  produceBorrowTxs(
    debtsToRepay: Map<string, BigNumber>,
    liquidationHelper: LiquidationHelper,
  ): EncodeObject[] {

    const borrowTxs: EncodeObject[] = []
    debtsToRepay.forEach((amount, denom) =>
      borrowTxs.push(
        makeBorrowMessage(
          liquidationHelper.getLiquidatorAddress(),
          denom,
          amount.toFixed(0),
          REDBANK_ADDRESS,
        ),
      ),
    )
    return borrowTxs
  }

  appendWithdrawMessages(
    collateralsWon: Collateral[],
    liquidatorAddress: string,
    maxBorrow: BigNumber,
    msgs: EncodeObject[],
  ) {
    // for each asset, create a withdraw message
    let totalRemainingBorrow = maxBorrow
    collateralsWon.forEach((collateral) => {
      const denom = collateral.denom
      if (denom !== NEUTRAL_ASSET_DENOM) {

        console.log({
          ACTION: 'Withdrawing collateral',
          denom,
        })
        msgs.push(
          executeContract(
            makeWithdrawMessage(liquidatorAddress, denom, addresses.redBank)
              .value as MsgExecuteContract,
          ), // osmo1h9twyldz0z0crzgqmafa9m30nll7xljzzge6fg - liquidator
        )
      }
    })

    return msgs
  }

  appendSwapToNeutralMessages(coins: Coin[], liquidatorAddress: string, msgs: EncodeObject[]) : BigNumber {
    let expectedNeutralCoins = new BigNumber(0)
    coins
      .filter((collateral) => collateral.denom !== NEUTRAL_ASSET_DENOM)
      .forEach((collateral) => {
        let collateralAmount =
          collateral.denom === GAS_TOKEN
            ? new BigNumber(collateral.amount).minus(100000000) // keep min 100 tokens for gas
            : new BigNumber(collateral.amount)

        if (collateralAmount.isGreaterThan(1000) && !collateralAmount.isNaN()) {
          const routeOptions = this.ammRouter.getRoutes(collateral.denom, NEUTRAL_ASSET_DENOM)

          const bestRoute = routeOptions
            .sort((routeA, routeB) => {
              const routeAReturns = this.ammRouter.getOutput(collateralAmount, routeA)
              const routeBReturns = this.ammRouter.getOutput(collateralAmount, routeB)
              return routeAReturns.minus(routeBReturns).toNumber()
            })
            .pop()

          if (bestRoute) {
            // allow for 2.5% slippage from what we estimated
            const minOutput = this.ammRouter
              .getOutput(new BigNumber(collateralAmount), bestRoute)
              .multipliedBy(0.975)
              .toFixed(0)

            console.log({
              ACTION: 'Swapping collateral to neutral',
              route: bestRoute,
              collateral,
              expectedOutput: minOutput,
            })

            expectedNeutralCoins = expectedNeutralCoins.plus(minOutput)
            msgs.push(
              swapExactAmountIn({
                sender: liquidatorAddress,
                // cast to long because osmosis felt it neccessary to create their own Long rather than use the js one
                routes: bestRoute?.map((route) => {
                  return { poolId: route.poolId as Long, tokenOutDenom: route.tokenOutDenom }
                }),
                tokenIn: { denom: collateral.denom, amount: Number(collateralAmount).toFixed(0) },
                tokenOutMinAmount: minOutput,
              }),
            )
          }
        }
      })

    return expectedNeutralCoins
  }

  appendSwapToDebtMessages(
    debtsToRepay: Coin[],
    liquidatorAddress: string,
    msgs: EncodeObject[],
    neutralAvailable: BigNumber
    // min available stables?
  ) {
    let remainingNeutral = neutralAvailable
    const expectedDebtAssetsPostSwap : Map<string, BigNumber> = new Map()

    debtsToRepay.forEach((debt) => {
      const debtAmountRequiredFromSwap = new BigNumber(debt.amount)
      if (debtAmountRequiredFromSwap.isGreaterThan(1000)) {
        const routeOptions = this.ammRouter.getRoutes(NEUTRAL_ASSET_DENOM, debt.denom)

        const bestRoute = routeOptions
          .sort((routeA, routeB) => {
            const routeAReturns = this.ammRouter.getRequiredInput(
              debtAmountRequiredFromSwap,
              routeA,
            )
            const routeBReturns = this.ammRouter.getRequiredInput(
              debtAmountRequiredFromSwap,
              routeB,
            )
            return routeAReturns.minus(routeBReturns).toNumber()
          })
          .pop()

        if (bestRoute) {

          const amountToSwap = this.ammRouter.getRequiredInput(
            // we add a little more to ensure we get enough to cover debt
            debtAmountRequiredFromSwap.multipliedBy(1.025), 
            bestRoute,
          )

          // if amount to swap is greater than the amount available, cap it
          const cappedSwapAmount = remainingNeutral.isLessThan(amountToSwap) ? remainingNeutral : amountToSwap

          // the min amount of debt we want to recieve
          const minDebtOutput = this.ammRouter.getOutput(cappedSwapAmount, bestRoute).multipliedBy(0.98)

          // take away 1 to avoid rounding errors / decimal places overshooting.
          remainingNeutral = neutralAvailable.minus(cappedSwapAmount.minus(1)) 
          expectedDebtAssetsPostSwap.set(debt.denom, minDebtOutput)
          console.log({
            ACTION: 'Swapping neutral to debt',
            route: bestRoute,
            debtAmountRequiredFromSwap,
            amountToSwap,
            cappedSwapAmount,
            minDebtOutput,
            remainingNeutral,
            debt,
          })

          msgs.push(
            swapExactAmountIn({
              sender: liquidatorAddress,
              // cast to long because osmosis felt it neccessary to create their own Long rather than use the js one
              routes: bestRoute?.map((route) => {
                return { poolId: route.poolId as Long, tokenOutDenom: route.tokenOutDenom }
              }),
              tokenIn: { denom: NEUTRAL_ASSET_DENOM, amount: amountToSwap.toFixed(0) },
              // allow for 1% slippage for debt what we estimated
              tokenOutMinAmount: minDebtOutput.toFixed(0),
            }),
          )
        }
      }
    })

    return expectedDebtAssetsPostSwap
  }

  appendRepayMessages(
    debtsToRepay: Debt[],
    liquidatorAddress: string,
    msgs: EncodeObject[],
    expectedDebtAssetAmounts: Map<string, BigNumber>
  ): EncodeObject[] {
    console.log({
      ACTION: 'REPAY',
      debtsToRepay,
      expectedDebtAssetAmounts
    })

    debtsToRepay.forEach((debt) => {
      // Cap the amount we are repaying by the amount available
      const debtAvailable = expectedDebtAssetAmounts.get(debt.denom) || new BigNumber(0)
      const debtToRepay = debtAvailable.isGreaterThan(debt.amount) ? new BigNumber(debt.amount) : debtAvailable
      if (debtToRepay.isGreaterThan(1000)) {
        msgs.push(
          makeRepayMessage(liquidatorAddress, REDBANK_ADDRESS, [
            {
              denom: debt.denom,
              amount: debtToRepay.toFixed(0),
            },
          ]),
        )
      }
    })

    return msgs
  }

  appendDepositMessages(liquidatorAddress: string, msgs: EncodeObject[]): EncodeObject[] {
    const balance = this.balances.get(NEUTRAL_ASSET_DENOM)

    if (!balance || balance === 0) return msgs
    msgs.push(
      makeDepositMessage(liquidatorAddress, NEUTRAL_ASSET_DENOM, REDBANK_ADDRESS, [
        { denom: NEUTRAL_ASSET_DENOM, amount: balance.toFixed(0) },
      ]),
    )

    return msgs
  }

  async run(liquidationHelper: LiquidationHelper, redis: IRedisInterface) {
    const liquidatorAddress = liquidationHelper.getLiquidatorAddress()

    if (!this.queryClient || !this.client)
      throw new Error("Instantiate your clients before calling 'run()'")

    // Find our limit we can borrow. Denominated in
    maxBorrow = await this.getMaxBorrow(liquidatorAddress)
    console.log({maxBorrow})
    await this.refreshPools()

    // refresh our balances
    await this.setBalances(liquidatorAddress)

    console.log('Checking for liquidations')
    const positions: Position[] = await redis.popUnhealthyPositions()

    if (positions.length == 0) {
      //sleep to avoid spamming redis db when empty
      await sleep(200)
      console.log(' - No items for liquidation yet')
      return
    }

    console.log({
      title: 'PRE LIQUIDATION',
      collaterals: await this.queryClient?.queryContractSmart(addresses.redBank, {
        user_collaterals: { user: liquidatorAddress },
      }),
      debts: await this.queryClient?.queryContractSmart(addresses.redBank, {
        user_debts: { user: liquidatorAddress },
      }),
      balances: await this.client?.getAllBalances(liquidatorAddress),
    })
    // Fetch position data
    const positionData: DataResponse[] = await fetchRedbankBatch(
      positions,
      addresses.redBank,
      HIVE_ENDPOINT,
    )

    console.log(`- found ${positionData.length} positions queued for liquidation.`)

    // fetch debts, liquidation txs
    const { txs, debtsToRepay } = this.produceLiquidationTxs(positionData)
    
    const debtCoins: Coin[] = []
    debtsToRepay.forEach((amount, denom) => debtCoins.push({ denom, amount: amount.toFixed(0) }))

    console.log({
      ACTION:"LIQUIDATE",
      txs,
      debtsToRepay,
      debtCoins
    })
    // deposit any neutral in our account before starting liquidations
    const firstMsgBatch : EncodeObject[] = []

    this.appendSwapToDebtMessages(debtCoins,liquidatorAddress, firstMsgBatch, new BigNumber(this.balances.get(NEUTRAL_ASSET_DENOM)!))
    
    // this.appendDepositMessages(liquidatorAddress, firstMsgBatch)


    // produce borrow tx's
    const borrowTxs = firstMsgBatch.concat(this.produceBorrowTxs(debtsToRepay, liquidationHelper))

    if (txs.length === 0 ) return

    // dispatch liquidation tx along with borrows, and recieve and object with results on it
    const results = await this.sendBorrowAndLiquidateTx(
      txs,
      borrowTxs,
      debtCoins,
      liquidationHelper,
    )


    // Log the amount of liquidations executed
    redis.incrementBy('executor.liquidations.executed', results.length)

    console.log(`- Successfully liquidated ${results.length} positions`)

    const collaterals: Collateral[] = await this.queryClient?.queryContractSmart(
      addresses.redBank,
      { user_collaterals: { user: liquidatorAddress } },
    )

    const debts: Debt[] = await this.queryClient?.queryContractSmart(addresses.redBank, {
      user_debts: { user: liquidatorAddress },
    })

    // todo remove me
    const balances = await this.client?.getAllBalances(liquidatorAddress)

    // reset balances, as they will have changed
    await this.setBalances(liquidatorAddress)
    const expectedAssets = this.combineBalances(collaterals, balances!)
    maxBorrow = await this.getMaxBorrow(liquidatorAddress)

    console.log({
      title: 'POST LIQUIDATION',
      collaterals,
      debts,
      balances,
      combinedBalances: expectedAssets,
    })

    // second block of transactions
    let msgs: EncodeObject[] = []
    
    // we need to maintain track of our asset estimates within the transaction
    const assets : Map<string, BigNumber> = new Map()

    msgs = this.appendWithdrawMessages(collaterals, liquidatorAddress, maxBorrow, msgs)
    const minNeutralRecieved = this.appendSwapToNeutralMessages(expectedAssets, liquidatorAddress, msgs) // get min collected stable?

    const assetAmounts = this.appendSwapToDebtMessages(debts, liquidatorAddress, msgs, minNeutralRecieved)
    assetAmounts.forEach((amount, denom) => assets.set(denom, amount))

    // add our wallet balances to the debt amounts
    this.balances.forEach((amount, denom) => {
      const assetFromSwap = assets.get(denom) || new  BigNumber(0)
      assets.set(denom, assetFromSwap.plus(amount))
    })

    // add our neutral amount to it as this wont be recorded in our swap to debt
    const neutralAssetAmount = assets.get(NEUTRAL_ASSET_DENOM) || new  BigNumber(0)
    assets.set(NEUTRAL_ASSET_DENOM, neutralAssetAmount.plus(minNeutralRecieved))
    console.log({assts2:assets})
    
    this.appendRepayMessages(debts, liquidatorAddress, msgs, assets)

    if (msgs.length > 0) {
      const result = await this.client?.signAndBroadcast(
        liquidatorAddress,
        msgs,
        await this.getFee(msgs, liquidatorAddress),
      )
    }

    const finalCollaterals = await this.queryClient?.queryContractSmart(addresses.redBank, {
      user_collaterals: { user: liquidatorAddress },
    })
    console.log(`- Liquidation Process Complete.`)
    console.log({
      title: 'POST CLEANUP',
      collaterals: finalCollaterals,
      debts: await this.queryClient?.queryContractSmart(addresses.redBank, {
        user_debts: { user: liquidatorAddress },
      }),
      walletBalance: await this.client?.getAllBalances(liquidatorAddress),
    })

    this.writeCsv()
    // get liquidator balance

  }

  combineBalances(collaterals: Collateral[], balances: readonly Coin[]): Coin[] {
    const coinMap: Map<string, Coin> = new Map()

    collaterals.forEach((collateral) =>
      coinMap.set(collateral.denom, {
        denom: collateral.denom,
        amount: Number(collateral.amount).toFixed(0),
      }),
    )

    balances.forEach((balance) => {
      const denom = balance.denom
      const amount = balance.amount
      const existingBalance = coinMap.get(denom)?.amount || 0
      const newBalance = (Number(existingBalance) + Number(amount)).toFixed(0)
      const newCoin = { denom, amount: newBalance }
      coinMap.set(denom, newCoin)
    })

    const result: Coin[] = []
    coinMap.forEach((coin) => result.push(coin))
    return result
  }

  sendBorrowAndLiquidateTx = async (
    txs: LiquidationTx[],
    borrowMessages: EncodeObject[],
    coins: Coin[],
    liquidationHelper: LiquidationHelper,
  ): Promise<LiquidationResult[]> => {
    if (!this.client)
      throw new Error(
        'Stargate Client is undefined, ensure you call initiate at before calling this method',
      )
    const liquidateMsg = JSON.stringify({ liquidate_many: { liquidations: txs } })

    const msg = toUtf8(liquidateMsg)

    const msgs: EncodeObject[] = borrowMessages

    console.log({liq:liquidationHelper.getLiquidationFiltererContract()})

    msgs.push(
      executeContract(
        makeExecuteContractMessage(
          liquidationHelper.getLiquidatorAddress(),
          liquidationHelper.getLiquidationFiltererContract(),
          msg,
          coins,
        ).value as MsgExecuteContract,
      ),
    )

    if (!msgs || msgs.length === 0) return []

    const result = await this.client.signAndBroadcast(
      liquidationHelper.getLiquidatorAddress(),
      msgs,
      await this.getFee(msgs, liquidationHelper.getLiquidatorAddress()),
    )

    if (!result || !result.rawLog) return []
    
    const collaterals: Collateral [] = await this.queryClient?.queryContractSmart(
      addresses.redBank,
      { user_collaterals: { user: liquidationHelper.getLiquidatorAddress() } },
    )

    const usdcCollateral = collaterals.find((collateral) => collateral.denom === 'usdc')
      console.log({usdcCollateral})
    txs.forEach((tx) => {
      this.addCsvRow({
        blockHeight: result.height,
        collateral: tx.collateral_denom,
        debtRepaid: tx.debt_denom,
        userAddress: tx.user_address,
        estimatedLtv: '0.99',
        liquidatorBalance: Number(usdcCollateral?.amount)
      })
    })
    
    // this.
    // result.events.forEach((value) => console.log(value))
    // console.log({data:result.data})
    // console.log(result.height)
    const events = JSON.parse(result.rawLog)[0]

    return liquidationHelper.parseLiquidationResult(events.events)
  }
  getFee = async (msgs: EncodeObject[], address: string) => {
    if (!this.client)
      throw new Error(
        'Stargate Client is undefined, ensure you call initiate at before calling this method',
      )
    const gasEstimated = await this.client.simulate(address, msgs, '')
    const fee = {
      amount: coins(60000, 'uosmo'),
      gas: Number(gasEstimated * 1.3).toFixed(0),
    }

    return fee
  }
}
