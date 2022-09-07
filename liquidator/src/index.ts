import { IRedisInterface, RedisInterface } from "./redis"
import { LiquidationHelper } from "./liquidation_helpers"
import { Asset } from "./types/asset"
import { LiquidationResult, LiquidationTx } from "./types/liquidation"
import { Position } from "./types/position"
import { Coin, GasPrice } from "@cosmjs/stargate"
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing"
import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate"

const PREFIX = process.env.PREFIX!
const GAS_PRICE = process.env.GAS_PRICE!
const RPC_ENDPOINT = process.env.RPC_ENDPOINT!
const LIQUIDATION_FILTERER_CONTRACT = process.env.LIQUIDATION_FILTERER_CONTRACT!

// todo don't store in .env
const SEED = process.env.SEED!

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

    const liquidationHelper = new LiquidationHelper(client,liquidatorAddress, LIQUIDATION_FILTERER_CONTRACT)  

    // run
    while (true) await run(liquidationHelper, redis)
}

// exported for testing
export const run = async (txHelper: LiquidationHelper, redis : IRedisInterface) => {
    const positions : Position[] = await redis.fetchUnhealthyPositions()
    
    if (positions.length == 0) return

    const txs: LiquidationTx[] = []
    const coins: Coin[] = []

    // for each address, send liquidate tx
    positions.forEach((position: Position) => {
        const tx = txHelper.produceLiquidationTx(position)
        txs.push(tx)
        const amount : number = position.debts.find((debt: Asset) => debt.denom === tx.debt_denom)?.amount || 0 

        // TODO handle not finding the asset in list above - this should never happen but we should handle regardless

        coins.push({denom: tx.debt_denom, amount: amount.toString()})
    })
    
    // dispatch transactions - return object with results on it
    const results = await txHelper.sendLiquidationTxs(txs, coins)

    // Swap collaterals to replace the debt that was repaid
    results.forEach(async (result: LiquidationResult) => {
        
        await txHelper.swap(
            result.collateralReceivedDenom, 
            result.debtRepaidDenom, 
            Number(result.collateralReceivedAmount)
            )
    })
}


await main()