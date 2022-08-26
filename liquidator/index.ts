

// Program entry
const main = () => {
    // fetch addresses from redis
    const redis = new Redis()
    // await redis.connect()
    const txHelper = new TxHelper()  

    // run
    while (true) run(txHelper, redis)
   
}


const run = (txHelper: TxHelper, redis : Redis) => {
    const addresses : string[] = redis.fetchUnhealthyAddresses()
    
    if (addresses.length == 0) return

    // for each address, send liquidate tx
    const txs : LiquidationTx[] = addresses.map((address: string) => txHelper.produceLiquidationTx(address))
    
    // dispatch transactions
    txHelper.sendLiquidationTxs(txs)
}
