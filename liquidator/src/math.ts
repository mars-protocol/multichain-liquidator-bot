
/**
 * Calculates the output of y for any given swap in an xy=k (constant product) liquidity pool.
 * 
 * In this case, x is the token we are putting into the pool (selling), y is the token we are
 * taking out (buying)
 * 
 * @param y1 Number of y tokens in the pool before the swap
 * @param x1 Number of x tokens in the pool before the swap
 * @param xChange The number of x tokens we are selling
 * @return The number of y tokens we will recieve
 */
export const calculateOutputXYKPool = (x1 : number, y1 : number, xChange : number) => {
    
    // ∆y = (∆x / (x1 + ∆x)) * y1
    return (xChange / (x1 + xChange)) * y1
}

/**
 * Calculates basis points of slippage for a given swap in an xy=k (constant product) liquidity pool.
 * 
 * In this case, x is the token we are putting into the pool (selling), y is the token we are
 * taking out (buying)
 * 
 * @param y1 Number of y tokens in the pool before the swap
 * @param x1 Number of x tokens in the pool before the swap
 * @param xChange The number of x tokens we are selling
 * @return The number of y tokens we will recieve
 */
export const calculateSlippageBp = (x1: number, y1 : number, xChange : number) => {

    const initialPrice = x1 / y1
    const estimatedSettlementPrice = calculateOutputXYKPool(x1,y1,xChange)
    const priceDifference = initialPrice - estimatedSettlementPrice

    // scale to percentage
    const percentageDifference = (priceDifference / initialPrice) * 100

    // scale to bp
    return percentageDifference * 100
}