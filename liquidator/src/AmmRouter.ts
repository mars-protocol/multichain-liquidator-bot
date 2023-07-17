import BigNumber from 'bignumber.js'
import { calculateOutputXYKPool, calculateRequiredInputXYKPool } from './math'
import { RouteHop } from './types/RouteHop'
import { ConcentratedLiquidityPool, Pool, PoolType, StableswapPool, XYKPool } from './types/Pool'
import { ConcentratedLiquidityMath } from "./amm/osmosis/math/concentrated"

import { Coin, Dec, Int } from '@keplr-wallet/unit'
import { StableSwapMath, StableSwapToken } from '@osmosis-labs/math'
const { calcOutGivenIn, calcInGivenOut } = ConcentratedLiquidityMath

export interface AMMRouterInterface {
	getRoutes(tokenInDenom: string, tokenOutDenom: string): RouteHop[][]
}

/**
 * Router provides a route to swap between any two given assets.
 *
 */
export class AMMRouter implements AMMRouterInterface {
	private pools: Pool[]
	constructor() {
		this.pools = []
	}

	setPools(pools: Pool[]) {
		this.pools = pools
	}

	getPools(): Pool[] {
		return this.pools
	}

	getPool(id: string): Pool | undefined {
		return this.pools.find((pool) => pool.id.toString() === id)
	}

	/**
	 * Calculates the expected output of `tokenOutDenom` using the given route
	 * @param tokenInAmount
	 * @param route
	 * @return The estimated amount of asset we think we will recieve
	 */
	getOutput(tokenInAmount: BigNumber, route: RouteHop[]): BigNumber {
		let amountAfterFees = new BigNumber(0)

		if (tokenInAmount.isEqualTo(0)) {
			console.log('ERROR - cannot use token in amount of 0')
			return amountAfterFees
		}

		// for each hop
		route.forEach((routeHop) => {

			const pool = routeHop.pool

			switch (pool.poolType) {
				case PoolType.XYK:
					const xykPool= pool as XYKPool
					const x1 = new BigNumber(
						xykPool.poolAssets.find(
							(poolAsset) => poolAsset.token.denom === routeHop.tokenInDenom,
						)?.token.amount!,
					)

					const y1 = new BigNumber(
						xykPool.poolAssets.find(
							(poolAsset) => poolAsset.token.denom === routeHop.tokenOutDenom,
						)?.token.amount!,
					)

					const amountBeforeFees = calculateOutputXYKPool(
						x1,
						y1,
						new BigNumber(tokenInAmount),
					)
					amountAfterFees = amountBeforeFees.minus(amountBeforeFees.multipliedBy(routeHop.pool.swapFee))
					tokenInAmount = amountAfterFees
					break
				case PoolType.CONCENTRATED_LIQUIDITY:

					const clPool = pool as ConcentratedLiquidityPool

					const tokenIn : Coin = {
						denom: routeHop.tokenInDenom,
						amount: new Int(tokenInAmount.toFixed(0))
					}

					const tokenDenom0 = clPool.token0
					const poolLiquidity = new Dec(clPool.currentTickLiquidity)
					const inittedTicks = tokenIn.denom === tokenDenom0 ? clPool.liquidityDepths.zeroToOne : clPool.liquidityDepths.oneToZero
					const curSqrtPrice = new Dec(clPool.currentSqrtPrice)
					const swapFee = new Dec(clPool.swapFee)

					const result = calcOutGivenIn({
						tokenIn,
						tokenDenom0,
						poolLiquidity,
						inittedTicks,
						curSqrtPrice,
						swapFee,
					  });

					if (result === "no-more-ticks") {
						tokenInAmount = new BigNumber(0)
						break
					}

					const { amountOut } = result
					tokenInAmount = new BigNumber(amountOut.toString())
					break
				case PoolType.STABLESWAP:

					const ssPool = pool as StableswapPool

					// Produce scaling tokens
					// @ts-expect-error - osmosis types are out of date
					const tokens : StableSwapToken[] = ssPool.poolLiquidity.map((poolLiquidity, index) => {
						return {
							amount: new Dec(poolLiquidity.amount),
							denom: poolLiquidity.denom,
							scalingFactor : new BigNumber(ssPool.scalingFactors[index])
						}
					})

					const ssOutGivenInIncludingFees = StableSwapMath.calcOutGivenIn(
						tokens,
						{
							// @ts-expect-error - osmosis types are out of date
							amount: new Int(tokenInAmount.toString()),
							denom: routeHop.tokenInDenom,
						},
						routeHop.tokenOutDenom,
						new Dec(ssPool.poolParams.swapFee),
					)

					tokenInAmount = new BigNumber(ssOutGivenInIncludingFees.toString())
					break
			}
		})

		return amountAfterFees
	}

	getRequiredInput(tokenOutRequired: BigNumber, route: RouteHop[]): BigNumber {
		let amountAfterFees = new BigNumber(0)

		if (tokenOutRequired.isEqualTo(0)) {
			console.log('ERROR - cannot use token out amount of 0')
			return amountAfterFees
		}

		// for each hop
		route.forEach((routeHop) => {
			const pool = routeHop.pool
			switch (routeHop.pool.poolType) {
				case PoolType.XYK:
					const xykPool=  pool as XYKPool
					const x1 = new BigNumber(
						xykPool.poolAssets.find(
							(poolAsset) => poolAsset.token.denom === routeHop.tokenInDenom,
						)?.token.amount!,
					)

					const y1 = new BigNumber(
						xykPool.poolAssets.find(
							(poolAsset) => poolAsset.token.denom === routeHop.tokenOutDenom,
						)?.token.amount!,
					)

					const amountInBeforeFees = calculateRequiredInputXYKPool(
						new BigNumber(x1),
						new BigNumber(y1),
						new BigNumber(tokenOutRequired),
					)
					amountAfterFees = amountInBeforeFees.plus(tokenOutRequired.multipliedBy(routeHop.pool.swapFee))
					tokenOutRequired = amountAfterFees
					break
				case PoolType.CONCENTRATED_LIQUIDITY:

					const clPool = pool as ConcentratedLiquidityPool

					const tokenOut : Coin = {
						denom: routeHop.tokenOutDenom,
						amount: new Int(tokenOutRequired.toFixed(0))
					}

					const tokenDenom0 = clPool.token0
					const poolLiquidity = new Dec(clPool.currentTickLiquidity)
					const inittedTicks = tokenOut.denom === tokenDenom0 ? clPool.liquidityDepths.zeroToOne : clPool.liquidityDepths.oneToZero
					const curSqrtPrice = new Dec(clPool.currentSqrtPrice)
					const swapFee = new Dec(clPool.swapFee)

					const result = calcInGivenOut({
						tokenOut,
						tokenDenom0,
						poolLiquidity,
						inittedTicks,
						curSqrtPrice,
						swapFee,
					  })

					if (result === "no-more-ticks") {
						tokenOutRequired = new BigNumber(0)
						break
					} 

					const { amountIn } = result
					amountAfterFees = new BigNumber(amountIn.toString())
					tokenOutRequired = amountAfterFees
					break

					case PoolType.STABLESWAP:

					const ssPool = pool as StableswapPool

					// Produce scaling tokens
					//@ts-expect-error - osmosis type import is behind
					const tokens : StableSwapToken[] = ssPool.poolLiquidity.map((poolLiquidity, index) => {
						return {
							amount: new Dec(poolLiquidity.amount),
							denom: poolLiquidity.denom,
							scalingFactor : new BigNumber(ssPool.scalingFactors[index])
						}
					})

					const ssInGivenOutIncludingFees = StableSwapMath.calcInGivenOut(
						tokens,
						{
							//@ts-expect-error - osmosis type import is behind
							amount: new Int(tokenOutRequired.toString()),
							denom: routeHop.tokenOutDenom,
						},
						routeHop.tokenOutDenom,
						new Dec(ssPool.poolParams.swapFee),
					)

					tokenOutRequired = new BigNumber(ssInGivenOutIncludingFees.toString())
					break
					
			}
		})

		return amountAfterFees
	}

	getBestRouteGivenInput(
		tokenInDenom: string,
		tokenOutDenom: string,
		amountIn: BigNumber,
	): RouteHop[] {
		const routeOptions = this.getRoutes(tokenInDenom, tokenOutDenom)

		return this.getRouteWithHighestOutput(amountIn, routeOptions)
	}

	getRouteWithHighestOutput(amountIn: BigNumber, routes: RouteHop[][]): RouteHop[] {
		const bestRoute = routes
			.sort((routeA, routeB) => {
				const routeAReturns = this.getOutput(amountIn, routeA)
				const routeBReturns = this.getOutput(amountIn, routeB)
				return routeAReturns.minus(routeBReturns).toNumber()
			})
			.pop()

		return bestRoute || []
	}

	getRouteWithLowestInput(amountOut: BigNumber, routes: RouteHop[][]): RouteHop[] {
		const bestRoute = routes
			.sort((routeA, routeB) => {
				const routeAReturns = this.getRequiredInput(amountOut, routeA)
				const routeBReturns = this.getRequiredInput(amountOut, routeB)

				// route a is a better route if it returns
				return routeAReturns.minus(routeBReturns).toNumber()
			})
			.pop()

		return bestRoute || []
	}

	getBestRouteGivenOutput(
		tokenInDenom: string,
		tokenOutDenom: string,
		amountOut: BigNumber,
	): RouteHop[] {
		const routeOptions = this.getRoutes(tokenInDenom, tokenOutDenom)
		return this.getRouteWithLowestInput(amountOut, routeOptions)
	}

	getRoutes(tokenInDenom: string, tokenOutDenom: string): RouteHop[][] {
		return this.buildRoutesForTrade(tokenInDenom, tokenOutDenom, this.pools, [], [])
	}

	// We want to list all assets in the route except our last denom (tokenOutDenom)
	private findUsedPools = (route: RouteHop[]): Long[] => {
		return route.map((hop) => hop.poolId)
	}

	private buildRoutesForTrade(
		tokenInDenom: string,
		targetTokenOutDenom: string,
		pools: Pool[],
		route: RouteHop[],
		routes: RouteHop[][],
	): RouteHop[][] {
		// we don't want to search through the same pools again and loop, so we delete filter pools that
		// exist in the route
		const usedPools = this.findUsedPools(route)

		// all pairs that have our sell asset, and are not previously in our route
		const possibleStartingPairs = pools.filter((pool) => {
			return (
				(pool.token0 === tokenInDenom ||
					pool.token1 === tokenInDenom) &&
				// ensure we don't use the same pools
				usedPools.find((poolId) => pool.id === poolId) === undefined
			)
		})

		// no more possible pools then we exit
		if (possibleStartingPairs.length === 0) {
			return routes
		}

		// if we find an ending par(s), we have found the end of our route
		const endingPairs = possibleStartingPairs.filter(
			(pool) =>
				pool.token0 === targetTokenOutDenom ||
				pool.token1 === targetTokenOutDenom,
		)

		if (endingPairs.length > 0 && tokenInDenom !== targetTokenOutDenom) {
			endingPairs.forEach((pool) => {
				const hop: RouteHop = {
					poolId: pool.id,
					tokenInDenom: tokenInDenom,
					tokenOutDenom: targetTokenOutDenom,
					pool: pool,
				}

				// deep copy the array
				const routeClone: RouteHop[] = JSON.parse(JSON.stringify(route))
				routeClone.push(hop)
				routes.push(routeClone)
			})

			// return routes
		} else {
			// Else, we have not found the route. Iterate recursively through the pools building valid routes.
			possibleStartingPairs.forEach((pool) => {
				// We have no garauntee that index [0] will be the token in so we need to calculate that ourselves
				const tokenOut = tokenInDenom === pool.token0 ? pool.token1 : pool.token0

				const nextHop: RouteHop = {
					poolId: pool.id,
					tokenInDenom,
					tokenOutDenom: tokenOut,
					pool: pool,
				}

				// deep copy so we don't mess up other links in the search
				const newRoute: RouteHop[] = JSON.parse(JSON.stringify(route))

				newRoute.push(nextHop)

				this.buildRoutesForTrade(
					tokenOut,
					targetTokenOutDenom,
					pools,
					newRoute,
					routes,
				)
			})
		}
		return routes
	}
}
