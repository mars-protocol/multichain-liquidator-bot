import { IRedisInterface, RedisInterface } from './redis.js'
import { LiquidationHelper } from './liquidation_helpers.js'
import { Asset } from './types/asset'
import { LiquidationResult, LiquidationTx } from './types/liquidation.js'
import { Position } from './types/position'
import { Coin, GasPrice } from '@cosmjs/stargate'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from '@cosmjs/cosmwasm-stargate'
import {
  ProtocolAddresses,
  // ProtocolAddresses,
  sleep,
} from './helpers.js'
import { osmosis } from 'osmojs'
import fetch from 'node-fetch';

import 'dotenv/config.js'
import { fetchBatch } from './hive.js'

const PREFIX = process.env.PREFIX!
const GAS_PRICE = process.env.GAS_PRICE || '0.01uosmo'
const RPC_ENDPOINT = process.env.RPC_ENDPOINT!
const HIVE_ENDPOINT = process.env.HIVE_ENDPOINT!
const LIQUIDATION_FILTERER_CONTRACT = process.env.LIQUIDATION_FILTERER_CONTRACT!
const LIQUIDATABLE_ASSETS : string[]= JSON.parse(
  process.env.LIQUIDATABLE_ASSETS!
)

// todo don't store in .env
const SEED = process.env.SEED!

// const deployDetails = path.join(process.env.OUTPOST_ARTIFACTS_PATH!, `${process.env.CHAIN_ID}.json`)
// const addresses: ProtocolAddresses = readAddresses(deployDetails)

const addresses: ProtocolAddresses = {
    oracle: process.env.CONTRACT_ORACLE_ADDRESS as string,
    redBank: process.env.CONTRACT_REDBANK_ADDRESS as string,
    addressProvider: "",
    filterer: "",
    incentives: "",
    rewardsCollector: ""
}

const balances : Map<string, number> = new Map()

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

  console.log(balances)
  // run
  while (true) await run(liquidationHelper, redis)
}


const setBalances = async(client : SigningCosmWasmClient, liquidatorAddress: string) => {
  for (const denom in LIQUIDATABLE_ASSETS) {
    const balance = await client.getBalance(liquidatorAddress, LIQUIDATABLE_ASSETS[denom])
    balances.set(LIQUIDATABLE_ASSETS[denom], Number(balance.amount))
  }
}

// exported for testing
export const run = async (liquidationHelper: LiquidationHelper, redis: IRedisInterface) => {
  const positions: Position[] = await redis.fetchUnhealthyPositions()
  if (positions.length == 0) {
    //sleep to avoid spamming redis db when empty
    await sleep(200)
    console.log("No items for liquidation yet")
    return
  }


  const positionData = await fetchBatch(positions, addresses.redBank, HIVE_ENDPOINT)

  const txs: LiquidationTx[] = []
  const debtsToRepay = new Map<string, number>()  

  // for each address, send liquidate tx
  positions.forEach((position: Position) => {
    // we can only liquidate what we have in our wallet

    const tx = liquidationHelper.produceLiquidationTx(position)
    const debtDenom = tx.debt_denom
    const amount: number =
      Number(position.Debts.find((debt: Asset) => debt.token === debtDenom)?.amount || 0)

    const debtAmount = debtsToRepay.get(tx.debt_denom) || 0

    const totalNewDebt = debtAmount + amount

    const walletBalance = balances.get(tx.debt_denom) || 0
    if (walletBalance > totalNewDebt) {
      txs.push(tx)
      debtsToRepay.set(tx.debt_denom, totalNewDebt)
    } else{
      console.log(`cannot liquidate liquidatable position because we do not have enough assets`)
    }
  })

  const coins: Coin[] = []

  debtsToRepay.forEach((amount, denom) => coins.push({ denom, amount: amount.toFixed(0) }))

  // dispatch liquidation tx , and recieve and object with results on it
  const results = await liquidationHelper.sendLiquidationsTx(txs, coins)

  // Log the amount of liquidations executed
  redis.incrementBy('executor.liquidations.executed', results.length)

  console.log(`liquidated ${results.length} positions`)
  for (const index in results) {
    const liquidation: LiquidationResult = results[index]
    await liquidationHelper.swap(
      liquidation.collateralReceivedDenom,
      liquidation.debtRepaidDenom,
      Number(liquidation.collateralReceivedAmount),
    )
  }
}

main().catch((e) => {
  console.log(e)
  process.exit(1)
})
