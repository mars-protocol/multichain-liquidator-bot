import BigNumber from 'bignumber.js'
import { calculateOutputXYKPool, calculateRequiredInputXYKPool } from './math'
import { RouteHop } from './types/RouteHop'
import { ConcentratedLiquidityPool, Pool, PoolType, XYKPool } from './types/Pool'
// import { ConcentratedLiquidityMath } from "./amm/osmosis/math/concentrated"

import { Coin, Dec, Int } from '@keplr-wallet/unit'
import { ConcentratedLiquidityMath, BigDec } from '@osmosis-labs/math'
import Long from 'long'
// const { calcOutGivenIn, calcInGivenOut } = ConcentratedLiquidityMath

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

		try {
			// for each hop
			route.forEach((routeHop) => {
				const pool = routeHop.pool

				switch (pool.poolType) {
					case PoolType.XYK:
						const xykPool = pool as XYKPool
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

						if (tokenInAmount.dividedBy(x1).isGreaterThan(0.005)) {
							throw new Error(
								`Pool with id : ${
									pool.id
								} is too illiquid. X1: ${x1.toString()} tokenInAmount: ${tokenInAmount.toString()}`,
							)
						}

						const amountBeforeFees = calculateOutputXYKPool(x1, y1, tokenInAmount)

						if (amountBeforeFees.isLessThanOrEqualTo(0)) {
							throw new Error('amount in before fees is less than 0')
						}

						amountAfterFees = amountBeforeFees.minus(
							amountBeforeFees.multipliedBy(routeHop.pool.swapFee),
						)
						tokenInAmount = amountAfterFees
						break
					case PoolType.CONCENTRATED_LIQUIDITY:
						const clPool = pool as ConcentratedLiquidityPool

						const tokenIn: Coin = {
							denom: routeHop.tokenInDenom,
							amount: new Int(tokenInAmount.toFixed(0)),
						}

						const tokenDenom0 = clPool.token0
						const poolLiquidity = new Dec(clPool.currentTickLiquidity)
						const inittedTicks =
							tokenIn.denom === tokenDenom0
								? clPool.liquidityDepths.zeroToOne
								: clPool.liquidityDepths.oneToZero
						const curSqrtPrice = new BigDec(clPool.currentSqrtPrice)
						const swapFee = new Dec(clPool.swapFee)
						const result = ConcentratedLiquidityMath.calcOutGivenIn({
							tokenIn,
							tokenDenom0,
							poolLiquidity,
							inittedTicks,
							curSqrtPrice,
							swapFee,
						})

						if (result === 'no-more-ticks') {
							throw new Error('no more ticks')
						}

						const { amountOut } = result
						amountAfterFees = new BigNumber(amountOut.toString())
						if (amountAfterFees.isLessThanOrEqualTo(0)) {
							throw new Error('amount in after fees is less than 0')
						}
						tokenInAmount = amountAfterFees
						break
					case PoolType.STABLESWAP:
						// const ssPool = pool as StableswapPool

						// // Produce scaling tokens
						// // @ts-expect-error - osmosis types are out of date
						// const tokens : StableSwapToken[] = ssPool.poolLiquidity.map((poolLiquidity, index) => {
						// 	return {
						// 		amount: new Dec(poolLiquidity.amount),
						// 		denom: poolLiquidity.denom,
						// 		scalingFactor : new BigNumber(ssPool.scalingFactors[index])
						// 	}
						// })

						// const ssOutGivenInIncludingFees = StableSwapMath.calcOutGivenIn(
						// 	tokens,
						// 	{
						// 		amount: new Int(tokenInAmount.toFixed(0)),
						// 		denom: routeHop.tokenInDenom,
						// 	},
						// 	routeHop.tokenOutDenom,
						// 	new Dec(ssPool.poolParams.swapFee),
						// )

						// tokenInAmount = new BigNumber(ssOutGivenInIncludingFees.toString())
						// tokenInAmount = new BigNumber(0)
						throw new Error('stable swap not supported')
				}
			})
		} catch (ex) {
			return new BigNumber(0)
		}

		return amountAfterFees
	}

	getRequiredInput(tokenOutRequired: BigNumber, route: RouteHop[]): BigNumber {
		let amountAfterFees = new BigNumber(0)

		if (tokenOutRequired.isEqualTo(0)) {
			console.log('ERROR - cannot use token out amount of 0')
			return amountAfterFees
		}
		try {
			route.forEach((routeHop) => {
				const pool = routeHop.pool
				switch (routeHop.pool.poolType) {
					case PoolType.XYK:
						const xykPool = pool as XYKPool
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

						if (tokenOutRequired.dividedBy(y1).isGreaterThan(0.005)) {
							throw new Error(
								`Pool with id : ${
									pool.id
								} is too illiquid. X1: ${x1.toString()} tokenInAmount: ${tokenOutRequired.toString()}`,
							)
						}

						const amountInBeforeFees = calculateRequiredInputXYKPool(
							new BigNumber(x1),
							new BigNumber(y1),
							new BigNumber(tokenOutRequired),
						)

						if (amountInBeforeFees.isLessThanOrEqualTo(0)) {
							throw new Error('amount in before fees is less than 0')
						}

						amountAfterFees = amountInBeforeFees.plus(
							tokenOutRequired.multipliedBy(routeHop.pool.swapFee),
						)
						tokenOutRequired = amountAfterFees
						break
					case PoolType.CONCENTRATED_LIQUIDITY:
						const clPool = pool as ConcentratedLiquidityPool

						const tokenOut: Coin = {
							denom: routeHop.tokenOutDenom,
							amount: new Int(tokenOutRequired.toFixed(0)),
						}

						const tokenDenom0 = clPool.token0
						const poolLiquidity = new Dec(clPool.currentTickLiquidity)
						const inittedTicks =
							tokenOut.denom === tokenDenom0
								? clPool.liquidityDepths.zeroToOne
								: clPool.liquidityDepths.oneToZero
						const curSqrtPrice = new BigDec(clPool.currentSqrtPrice)
						const swapFee = new Dec(clPool.swapFee)

						if (inittedTicks.length === 0) {
							tokenOutRequired = new BigNumber('10000000000000000')
							break
						}
						const result = ConcentratedLiquidityMath.calcInGivenOut({
							tokenOut,
							tokenDenom0,
							poolLiquidity,
							inittedTicks,
							curSqrtPrice,
							swapFee,
						})

						if (result === 'no-more-ticks') {
							tokenOutRequired = new BigNumber(10000000000000)
							break
						}

						const { amountIn } = result

						amountAfterFees = new BigNumber(amountIn.toString())
						if (amountAfterFees.isLessThanOrEqualTo(0)) {
							throw new Error('amount in after fees is less than 0')
						}
						tokenOutRequired = amountAfterFees
						break

					case PoolType.STABLESWAP:
						// const ssPool = pool as StableswapPool

						// // Produce scaling tokens
						// //@ts-expect-error - osmosis type import is behind
						// const tokens : StableSwapToken[] = ssPool.poolLiquidity.map((poolLiquidity, index) => {
						// 	return {
						// 		amount: new Dec(poolLiquidity.amount),
						// 		denom: poolLiquidity.denom,
						// 		scalingFactor : new BigNumber(ssPool.scalingFactors[index])
						// 	}

						// })

						// const ssInGivenOutIncludingFees = StableSwapMath.calcInGivenOut(
						// 	tokens,
						// 	{
						// 		amount: new Int(tokenOutRequired.toFixed(0)),
						// 		denom: routeHop.tokenOutDenom,
						// 	},
						// 	routeHop.tokenOutDenom,
						// 	new Dec(ssPool.poolParams.swapFee),
						// )

						// tokenOutRequired = new BigNumber(ssInGivenOutIncludingFees.toString())
						throw new Error('stableswap not implemented')
				}
			})
		} catch (ex) {
			return new BigNumber('100000000000000000000')
		}

		return amountAfterFees
	}

	async getBestRouteGivenInput(
		tokenInDenom: string,
		tokenOutDenom: string,
		amountIn: BigNumber,
	): Promise<RouteHop[]> {
		const routeOptions = this.getRoutes(tokenInDenom, tokenOutDenom)
		return this.getRouteWithHighestOutput(amountIn, routeOptions)
	}

	getRouteWithHighestOutput(amountIn: BigNumber, routes: RouteHop[][]): RouteHop[] {
		const bestRoute = routes
			.filter((route) => this.getOutput(amountIn, route).isGreaterThan(0) && route.length <= 1)
			.sort((routeA, routeB) => {
				if (routeA.length < routeB.length) {
					return 1
				}
				const routeAReturns = this.getOutput(amountIn, routeA)
				const routeBReturns = this.getOutput(amountIn, routeB)
				return routeBReturns.minus(routeAReturns).toNumber()
			})
			.reverse()
			.pop()
		return bestRoute || []
	}

	getRouteWithLowestInput(amountOut: BigNumber, routes: RouteHop[][]): RouteHop[] {
		const bestRoute = routes
			.filter((route) => {
				return this.getRequiredInput(amountOut, route).isGreaterThan(0)
			})
			.sort((routeA, routeB) => {
				const routeAReturns = this.getRequiredInput(amountOut, routeA)
				const routeBReturns = this.getRequiredInput(amountOut, routeB)
				// route a is a better route if it returns a higher value
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
		return this.buildRoutesForTrade(tokenInDenom, tokenOutDenom, this.pools)
	}

	// We want to list all assets in the route except our last denom (tokenOutDenom)
	private findUsedPools = (route: RouteHop[]): Long[] => {
		return route.map((hop) => hop.poolId)
	}

	private buildRoutesForTrade(
		tokenInDenom: string,
		targetTokenOutDenom: string,
		pools: Pool[],
	): RouteHop[][] {
		const completeRoutes: RouteHop[][] = []
		let routesInProgress: RouteHop[][] = []
		let maxRoutteLength = 3

		// all pairs that have our sell asset
		const startingPairs = pools.filter(
			(pool) => pool.token0 === tokenInDenom || pool.token1 === tokenInDenom,
		)

		// create routes for each possible starting pair
		startingPairs.forEach((pair) => {
			const hop: RouteHop = {
				poolId: pair.id,
				tokenInDenom: tokenInDenom,
				tokenOutDenom: tokenInDenom === pair.token0 ? pair.token1 : pair.token0,
				pool: pair,
			}

			const route = []
			route.push(hop)

			if (hop.tokenOutDenom === targetTokenOutDenom) {
				completeRoutes.push(route)
			} else {
				routesInProgress.push(route)
			}
		})

		while (routesInProgress.length > 0) {
			let updatedRoutes: RouteHop[][] = []
			routesInProgress.forEach((route) => {
				// Ids of pools we have previously used in this route
				let usedPoolIds = this.findUsedPools(route)
				let usedDenoms = route.map((hop) => hop.tokenInDenom)

				// the current end denom in the route
				let lastDenom = route[route.length - 1].tokenOutDenom

				pools.forEach((pool) => {
					if (
						(pool.token0 === lastDenom || pool.token1 === lastDenom) &&
						usedDenoms.indexOf(pool.token0) === -1 &&
						usedDenoms.indexOf(pool.token1) === -1 &&
						// ensure we don't use the same pools
						usedPoolIds.indexOf(pool.id) === -1
					) {
						// Add a route for each pool that has the last denom as an asset
						const hop: RouteHop = {
							poolId: pool.id,
							tokenInDenom: lastDenom,
							tokenOutDenom: lastDenom === pool.token0 ? pool.token1 : pool.token0,
							pool: pool,
						}

						// deep copy the array
						const routeClone: RouteHop[] = this.cloneRoute(route)
						routeClone.push(hop)

						// if we have reached the target token, add to complete routes, otherwise add to next routes
						if (hop.tokenOutDenom === targetTokenOutDenom) {
							completeRoutes.push(routeClone)
						} else if (routeClone.length < maxRoutteLength) {
							updatedRoutes.push(routeClone)
						}
					}
				})
			})
			routesInProgress = updatedRoutes
		}

		return completeRoutes
	}

	cloneRoute(route: RouteHop[]) {
		return route.map((hop: RouteHop) => {
			return {
				poolId: hop.poolId,
				tokenInDenom: hop.tokenInDenom,
				tokenOutDenom: hop.tokenOutDenom,
				pool: hop.pool,
			}
		})
	}
}
