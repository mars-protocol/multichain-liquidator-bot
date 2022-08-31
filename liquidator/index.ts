import { IRedisInterface, RedisInterface } from "./redis"
import { TxHelper } from "./tx_helpers"
import { LiquidationTx } from "./types/liquidation"
import { Position } from "./types/position"


// Program entry
export const main = async () => {
    // fetch addresses from redis
    const redis = new RedisInterface() 
    await redis.connect()
    const txHelper = new TxHelper()  

    // run
    while (true) await run(txHelper, redis)
   
}

// exported for testing
export const run = async (txHelper: TxHelper, redis : IRedisInterface) => {
    const positions : Position[] = redis.fetchUnhealthyPositions()
    
    if (positions.length == 0) return

    // for each address, send liquidate tx
    const txs : LiquidationTx[] = positions.map((position: Position) => txHelper.produceLiquidationTx(position))
    
    // dispatch transactions
    await txHelper.sendLiquidationTxs(txs)
}
