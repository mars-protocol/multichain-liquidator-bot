import { LiquidationHelper } from './liquidation_helpers.js'

import { LiquidationResult, LiquidationTx } from './types/liquidation.js'
import { Position } from './types/position'
import { Coin, GasPrice } from '@cosmjs/stargate'
import { DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from '@cosmjs/cosmwasm-stargate'
import {
  makeSwapMessage,
  makeWithdrawMessage,
  ProtocolAddresses,
  queryHealth,
  // ProtocolAddresses,
  sleep,
} from './helpers.js'
import { osmosis } from 'osmojs'

import 'dotenv/config.js'
import { DataResponse, Debt, fetchBatch } from './hive.js'
import { IRedisInterface, RedisInterface } from './redis.js'
import { SwapAmountInRoute } from 'osmojs/types/proto/osmosis/gamm/v1beta1/tx.js'
import { Asset } from './types/asset.js'

const PREFIX = process.env.PREFIX!
const GAS_PRICE = process.env.GAS_PRICE || '0.01uosmo'
const RPC_ENDPOINT = process.env.RPC_ENDPOINT!
const HIVE_ENDPOINT = process.env.HIVE_ENDPOINT!
const LIQUIDATION_FILTERER_CONTRACT = process.env.LIQUIDATION_FILTERER_CONTRACT!
const LIQUIDATABLE_ASSETS: string[] = JSON.parse(process.env.LIQUIDATABLE_ASSETS!)
console.log(process.env.ROUTES)
const ROUTES: Routes = JSON.parse(process.env.ROUTES!)

interface Routes {
  // Route for given pair [debt:collateral]
  [pair: string]: SwapAmountInRoute[]
}

interface Swaps {
  [key: string]: Coin
}

interface Collaterals {
  [key: string]: number
}

// todo don't store in .env
const SEED = process.env.SEED!

// const deployDetails = path.join(process.env.OUTPOST_ARTIFACTS_PATH!, `${process.env.CHAIN_ID}.json`)
// const addresses: ProtocolAddresses = readAddresses(deployDetails)

const addresses: ProtocolAddresses = {
  oracle: process.env.CONTRACT_ORACLE_ADDRESS as string,
  redBank: process.env.CONTRACT_REDBANK_ADDRESS as string,
  addressProvider: '',
  filterer: '',
  incentives: '',
  rewardsCollector: '',
}
console.log(ROUTES)
const balances: Map<string, number> = new Map()

// Program entry
export const main = async () => {
  const redis = new RedisInterface()
  await redis.connect()

  const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(SEED, { prefix: PREFIX })

  //The liquidator account should always be the first under that seed
  const liquidatorAddress = (await liquidator.getAccounts())[0].address

  const clientOption: SigningCosmWasmClientOptions = {
    gasPrice: GasPrice.fromString(GAS_PRICE),
  }

  const client = await SigningCosmWasmClient.connectWithSigner(
    RPC_ENDPOINT,
    liquidator,
    clientOption,
  )

  // add swap message
  const swapTypeUrl = '/osmosis.gamm.v1beta1.MsgSwapExactAmountIn'
  client.registry.register(swapTypeUrl, osmosis.gamm.v1beta1.MsgSwapExactAmountIn)

  const liquidationHelper = new LiquidationHelper(
    client,
    liquidatorAddress,
    LIQUIDATION_FILTERER_CONTRACT,
  )

  await setBalances(client, liquidatorAddress)

  // run
  while (true) await run(liquidationHelper, redis)
}

const setBalances = async (client: SigningCosmWasmClient, liquidatorAddress: string) => {
  for (const denom in LIQUIDATABLE_ASSETS) {
    const balance = await client.getBalance(liquidatorAddress, LIQUIDATABLE_ASSETS[denom])
    balances.set(LIQUIDATABLE_ASSETS[denom], Number(balance.amount))
  }
}

// exported for testing
export const run = async (liquidationHelper: LiquidationHelper, redis: IRedisInterface) => {
  console.log(`===============Running==================`)
  console.log({ balances })
  const positions: Position[] = await redis.fetchUnhealthyPositions()
  if (positions.length == 0) {
    //sleep to avoid spamming redis db when empty
    await sleep(200)
    console.log(' - No items for liquidation yet')
    return
  }

  const positionData: DataResponse[] = await fetchBatch(positions, addresses.redBank, HIVE_ENDPOINT)

  console.log(`- found ${positionData.length} positions queued for liquidation.`)
  const txs: LiquidationTx[] = []
  const debtsToRepay = new Map<string, number>()

  const healthQueries: Promise<any>[] = []

  // for each address, send liquidate tx
  positionData.forEach(async (positionResponse: DataResponse) => {
    // get actual data object
    const positionAddress = Object.keys(positionResponse.data)[0]

    // Logging stuff todo - remove me
    const healthQuery = queryHealth(liquidationHelper.client, positionAddress, addresses)
    healthQueries.push(healthQuery)

    const position = positionResponse.data[positionAddress]

    const tx = liquidationHelper.produceLiquidationTx(
      position.debts,
      position.collaterals,
      positionAddress,
    )
    const debtDenom = tx.debt_denom
    const amount: number = Number(
      position.debts.find((debt: Debt) => debt.denom === debtDenom)?.amount || 0,
    )

    const debtAmount = debtsToRepay.get(tx.debt_denom) || 0

    const totalNewDebt = debtAmount + amount

    const walletBalance = balances.get(tx.debt_denom) || 0
    if (walletBalance > totalNewDebt) {
      txs.push(tx)
      debtsToRepay.set(tx.debt_denom, totalNewDebt)
    } else {
      console.log(
        `- WARNING: Cannot liquidate liquidatable position for ${tx.user_address} because we do not have enough assets.`,
      )
      console.log({
        unliquidatableDebtSize: amount,
        scheduledForLiquidation: debtAmount,
        liquidatorBalance: walletBalance,
        denom: tx.debt_denom,
      })
    }
  })

  let healthy = 0
  for (const index in healthQueries) {
    await healthQueries[index].then((result) => {
      if (Number(result.health_status.borrowing.liq_threshold_hf) >= 1) {
        healthy += 1
      }
    })
  }
  const coins: Coin[] = []

  debtsToRepay.forEach((amount, denom) => coins.push({ denom, amount: amount.toFixed(0) }))

  // dispatch liquidation tx , and recieve and object with results on it
  const results = await liquidationHelper.sendLiquidationsTx(txs, coins)

  // Log the amount of liquidations executed
  redis.incrementBy('executor.liquidations.executed', results.length)

  const liquidatorAddress = liquidationHelper.getLiquidatorAddress()
  console.log(await queryHealth(liquidationHelper.client, liquidatorAddress, addresses))

  console.log(`- Successfully liquidated ${results.length} positions`)

  // record what routes require what swap amount
  const swaps: Swaps = {}
  const collaterals: Collaterals = {}

  // withdraw all the collateral we recieved, calculate all the debt to repay
  for (const index in results) {
    const liquidation: LiquidationResult = results[index]

    const collateralRecievedDenom = liquidation.collateralReceivedDenom
    const debtDenom = liquidation.debtRepaidDenom
    const amount = liquidation.collateralReceivedAmount
    const route = `${collateralRecievedDenom}:${debtDenom}`

    if (!swaps[route]) {
      const coin: Coin = { denom: collateralRecievedDenom, amount }
      swaps[route] = coin
    } else {
      const newAmount = Number(swaps[route].amount) + Number(amount)
      const coin: Coin = { denom: collateralRecievedDenom, amount: newAmount.toFixed(0) }
      swaps[route] = coin
    }

    // just mark this collateral as present
    collaterals[collateralRecievedDenom] = 0
  }
  const msgs: EncodeObject[] = []

  // for each asset, create a withdraw message
  Object.keys(collaterals).forEach((denom: string) =>
    msgs.push(makeWithdrawMessage(liquidatorAddress, denom, addresses.redBank)),
  )

  // for each route, build a swap message
  Object.keys(swaps).forEach((route: string) =>
    msgs.push(makeSwapMessage(liquidatorAddress, swaps[route], ROUTES[route])),
  )
  // console.log(await liquidationHelper.findRoute("a", "b"))
  await liquidationHelper.client.signAndBroadcast(liquidatorAddress, msgs, 'auto')
  console.log(`- Lquidation Process Complete.`)
}

main().catch((e) => {
  console.log(e)
  process.exit(1)
})
