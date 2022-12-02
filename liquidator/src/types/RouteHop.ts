import BigNumber from "bignumber.js"

export interface RouteHop {
    poolId:  Long
    tokenInDenom: string
    tokenOutDenom: string
    // What percentage of swap is given to LP's + protocol, as a decimal. 0.3% = 0.003
    swapFee : number

    // number of assets in the pool. x is same denom as tokenIn, y is same denom as tokenOut
    x1: BigNumber
    y1: BigNumber
}
