import BigNumber from 'bignumber.js'

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
export const calculateOutputXYKPool = (x1: BigNumber, y1: BigNumber, xChange: BigNumber) => {
	// ∆y = (∆x / (x1 + ∆x)) * y1
	return xChange.dividedBy(x1.plus(xChange)).multipliedBy(y1)
}

/**
 * Calculates the output of x we need to sell to recieve the desired amount of y.
 *
 * In this case, x is the token we are putting into the pool (selling), y is the token we are
 * taking out (buying)
 *
 * @param y1 Number of y tokens in the pool before the swap
 * @param x1 Number of x tokens in the pool before the swap
 * @param yChange The number of y tokens we are wanting to buy
 * @return The number of y tokens we will recieve
 */
export const calculateRequiredInputXYKPool = (x1: BigNumber, y1: BigNumber, yChange: BigNumber) => {
	// ∆x = (∆y / (y1 - ∆y)) * x1

	return yChange.dividedBy(y1.minus(yChange)).multipliedBy(x1)
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
 * @return The price impact of the swap, measured in basis points
 */
export const calculateSlippageBp = (x1: BigNumber, y1: BigNumber, xChange: BigNumber) => {
	const initialPrice = x1.dividedBy(y1)
	const estimatedSettlementPrice = calculateOutputXYKPool(x1, y1, xChange)
	const priceDifference = initialPrice.minus(estimatedSettlementPrice)

	// scale to percentage
	const percentageDifference = priceDifference.dividedBy(initialPrice).multipliedBy(100)

	// scale to bp (e.g 1% is 100bp)
	return percentageDifference.multipliedBy(100)
}
