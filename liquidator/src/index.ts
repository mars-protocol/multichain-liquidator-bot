import { LiquidationHelper } from './liquidation_helpers.js'

import { LiquidationResult, LiquidationTx } from './types/liquidation.js'
import { Position } from './types/position'
import { toUtf8 } from '@cosmjs/encoding'
import { Coin, SigningStargateClient } from '@cosmjs/stargate'
import { coins, DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { CosmWasmClient, ExecuteResult, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import {
  makeExecuteContractMessage,
  makeSwapMessage,
  makeWithdrawMessage,
  ProtocolAddresses,
  queryHealth,
  // ProtocolAddresses,
  sleep,
} from './helpers.js'
import { FEES, getSigningOsmosisClientOptions, osmosis, cosmwasm } from 'osmojs'

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

const {
  swapExactAmountIn
} = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl;

const {
  executeContract,
} = cosmwasm.wasm.v1.MessageComposer.withTypeUrl;

import { getSigningOsmosisClient, signAndBroadcast } from 'osmojs';
import { MsgExecuteContract } from 'osmojs/types/proto/cosmwasm/wasm/v1/tx.js'

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

const addresses: ProtocolAddresses = {
  oracle: process.env.CONTRACT_ORACLE_ADDRESS as string,
  redBank: process.env.CONTRACT_REDBANK_ADDRESS as string,
  addressProvider: '',
  filterer: '',
  incentives: '',
  rewardsCollector: '',
}

const balances: Map<string, number> = new Map()

let osmosisClient : SigningStargateClient
let cosmwasmQueryClient : CosmWasmClient

// Program entry
export const main = async () => {
  const redis = new RedisInterface()
  await redis.connect()

  const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(SEED, { prefix: PREFIX })

  //The liquidator account should always be the first under that seed
  const liquidatorAddress = (await liquidator.getAccounts())[0].address
  
  cosmwasmQueryClient = await SigningCosmWasmClient.connectWithSigner(
    RPC_ENDPOINT,
    liquidator
  )

  osmosisClient = await getSigningOsmosisClient({rpcEndpoint: RPC_ENDPOINT, signer: liquidator})

  const executeTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract'
  osmosisClient.registry.register(executeTypeUrl, cosmwasm.wasm.v1.MsgExecuteContract)
    
  const liquidationHelper = new LiquidationHelper(
    liquidatorAddress,
    LIQUIDATION_FILTERER_CONTRACT,
  )

  await setBalances(cosmwasmQueryClient, liquidatorAddress)

  // run
  while (true) await run(liquidationHelper, redis)
}

const getFee = () => {
  return {
    amount: coins(62500, 'uosmo'),
    gas: '25000000'
  }
}

const sendLiquidationsTx = async(txs: LiquidationTx[], coins: Coin[], liquidationHelper : LiquidationHelper): Promise<LiquidationResult[]> => {
  const liquidateMsg = JSON.stringify({liquidate_many: {liquidations: txs}})

  const msg = toUtf8(liquidateMsg)

  const msgs = [executeContract(
    makeExecuteContractMessage(liquidationHelper.getLiquidatorAddress(), liquidationHelper.getLiquidationFiltererContract(), msg,coins).value as MsgExecuteContract
  )]

  const result = await signAndBroadcast({
    client: osmosisClient,
    chainId: process.env.CHAIN_ID!,
    address: liquidationHelper.getLiquidatorAddress(),
    //@ts-ignore
    msgs: msgs,
    fee:getFee(),
    memo:'sss'
  }
  )

  if (!result || !result.rawLog) return []
  const events = JSON.parse(result.rawLog)[0]
  
  return liquidationHelper.parseLiquidationResult(events.events)
}

const setBalances = async (client: CosmWasmClient, liquidatorAddress: string) => {
  for (const denom in LIQUIDATABLE_ASSETS) {
    const balance = await client.getBalance(liquidatorAddress, LIQUIDATABLE_ASSETS[denom])
    balances.set(LIQUIDATABLE_ASSETS[denom], Number(balance.amount))
  }
}

// exported for testing
export const run = async (liquidationHelper: LiquidationHelper, redis: IRedisInterface) => {
  console.log(`*Running*`)
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

  // for each address, send liquidate tx
  positionData.forEach(async (positionResponse: DataResponse) => {
    // get actual data object
    const positionAddress = Object.keys(positionResponse.data)[0]

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
      // todo notify?
    }
  })

  
  const myCoins: Coin[] = []

  debtsToRepay.forEach((amount, denom) => myCoins.push({ denom, amount: amount.toFixed(0) }))

  // dispatch liquidation tx , and recieve and object with results on it
  const results = await sendLiquidationsTx(txs, myCoins, liquidationHelper)

  // Log the amount of liquidations executed
  redis.incrementBy('executor.liquidations.executed', results.length)

  const liquidatorAddress = liquidationHelper.getLiquidatorAddress()

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

  const msgs : Object[] = []

  // for each asset, create a withdraw message
  Object.keys(collaterals).forEach((denom: string) =>
    msgs.push(executeContract(
      makeWithdrawMessage(liquidatorAddress, denom, addresses.redBank).value as MsgExecuteContract
    ))
  )

  // for each route, build a swap message
  Object.keys(swaps).forEach((route: string) => msgs.push( swapExactAmountIn({
      sender:liquidatorAddress,
      routes:ROUTES[route],
      tokenIn: swaps[route],
      tokenOutMinAmount: '10', //todo test slippage
    }))
  )

  await signAndBroadcast({
    client: osmosisClient,
    chainId: 'localosmosis',
    address: liquidatorAddress,
    msgs: msgs,
    fee:getFee(),
    memo:'sss'
  })
  
  console.log(`- Lquidation Process Complete.`)
}

main().catch((e) => {
  console.log(e)
  process.exit(1)
})
