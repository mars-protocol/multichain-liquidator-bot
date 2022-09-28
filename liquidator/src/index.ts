import { IRedisInterface, RedisInterface } from "./redis.js"
import { LiquidationHelper } from "./liquidation_helpers.js"
import { Asset } from "./types/asset"
import { LiquidationResult, LiquidationTx } from "./types/liquidation.js"
import { Position } from "./types/position"
import { Coin, GasPrice } from "@cosmjs/stargate"
import { coin, DirectSecp256k1HdWallet, EncodeObject } from "@cosmjs/proto-signing"
import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate"
import { makeWithdrawMessage, ProtocolAddresses, queryHealth, readAddresses, sleep } from "./helpers.js"
import { osmosis } from "osmojs"

import path from 'path'
import 'dotenv/config.js'

const {
    swapExactAmountIn
} = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl;


const PREFIX = process.env.PREFIX!
const GAS_PRICE = process.env.GAS_PRICE!
const RPC_ENDPOINT = process.env.RPC_ENDPOINT!
const LIQUIDATION_FILTERER_CONTRACT = process.env.LIQUIDATION_FILTERER_CONTRACT!

// todo don't store in .env
const SEED = process.env.SEED!
const deployDetails = path.join(process.env.OUTPOST_ARTIFACTS_PATH!, `${process.env.CHAIN_ID}.json`)
const addresses : ProtocolAddresses = readAddresses(deployDetails)

// Program entry
export const main = async () => {

    const redis = new RedisInterface()
    await redis.connect()

    const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(SEED, { prefix: PREFIX });

    //The liquidator account should always be the first under that seed
    const liquidatorAddress = (await liquidator.getAccounts())[0].address

    const clientOption: SigningCosmWasmClientOptions = {
        gasPrice: GasPrice.fromString(GAS_PRICE)
    }

    const client = await SigningCosmWasmClient.connectWithSigner(RPC_ENDPOINT, liquidator, clientOption);
    
    // add swap message
    const swapTypeUrl = "/osmosis.gamm.v1beta1.MsgSwapExactAmountIn"
    client.registry.register(swapTypeUrl, osmosis.gamm.v1beta1.MsgSwapExactAmountIn)
    
    const liquidationHelper = new LiquidationHelper(client, liquidatorAddress, LIQUIDATION_FILTERER_CONTRACT)

    // run
    while (true) await run(
        liquidationHelper, 
        redis)
}



// exported for testing
export const run = async (
    liquidationHelper: LiquidationHelper, 
    redis: IRedisInterface) => {

    const positions : Position[] = await redis.fetchUnhealthyPositions()
    if (positions.length == 0){
       
        //sleep to avoid spamming redis db when empty
        sleep(200)

        return
    }

    const txs: LiquidationTx[] = []
    const debtsToRepay = new Map<string, number>()
    
    // for each address, send liquidate tx
    positions.forEach((position: Position) => {
        const tx = liquidationHelper.produceLiquidationTx(position)
        const debtDenom = tx.debt_denom
        txs.push(tx)
        const amount : number = position.debts.find((debt: Asset) => debt.denom === debtDenom)?.amount || 0 
        const debtAmount = debtsToRepay.get(tx.debt_denom) || 0 
        debtsToRepay.set(tx.debt_denom, debtAmount + amount)

        // TODO handle not finding the asset in list above - this should never happen but we should handle regardless
    })

    const coins : Coin[] = []

    debtsToRepay.forEach((amount, denom) => coins.push({denom, amount: amount.toFixed(0)}))

    // dispatch liquidation tx , and recieve and object with results on it
    const results = await liquidationHelper.sendLiquidationsTx(txs, coins)
    
     // Log the amount of liquidations executed
    redis.incrementBy("executor.liquidations.executed", results.length)

    console.log(`liquidated ${results.length} positions`)
    for (const index in results) {
        const liquidation: LiquidationResult = results[index]
        await liquidationHelper.swap(liquidation.collateralReceivedDenom, liquidation.debtRepaidDenom, Number(liquidation.collateralReceivedAmount))            
    }
}


main().catch(e => console.log(e))