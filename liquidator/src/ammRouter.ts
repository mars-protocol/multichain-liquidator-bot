import BigNumber from 'bignumber.js'
import { calculateOutputXYKPool, calculateRequiredInputXYKPool } from './math'
import { RouteHop } from './types/routeHop'
import { Pool } from './types/pool'
const BASE_ASSET_INDEX = 0
const QUOTE_ASSET_INDEX = 1

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
			const amountBeforeFees = calculateOutputXYKPool(
				new BigNumber(routeHop.x1),
				new BigNumber(routeHop.y1),
				new BigNumber(tokenInAmount),
			)
			amountAfterFees = amountBeforeFees.minus(amountBeforeFees.multipliedBy(routeHop.swapFee))
			tokenInAmount = amountAfterFees
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
			const amountInBeforeFees = calculateRequiredInputXYKPool(
				new BigNumber(routeHop.x1),
				new BigNumber(routeHop.y1),
				new BigNumber(tokenOutRequired),
			)
			amountAfterFees = amountInBeforeFees.plus(tokenOutRequired.multipliedBy(routeHop.swapFee))
			tokenOutRequired = amountAfterFees
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
				// todo  - support stableswap
				pool.poolAssets?.length > 1 &&
				(pool.poolAssets[BASE_ASSET_INDEX].token.denom === tokenInDenom ||
					pool.poolAssets[QUOTE_ASSET_INDEX].token.denom === tokenInDenom) &&
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
				pool.poolAssets[BASE_ASSET_INDEX].token.denom === targetTokenOutDenom ||
				pool.poolAssets[QUOTE_ASSET_INDEX].token.denom === targetTokenOutDenom,
		)

		// console.log(`endingPairs: ${endingPairs.length}`)
		if (endingPairs.length > 0 && tokenInDenom !== targetTokenOutDenom) {
			endingPairs.forEach((pool) => {
				const hop: RouteHop = {
					poolId: pool.id,
					tokenInDenom: tokenInDenom,
					tokenOutDenom: targetTokenOutDenom,
					swapFee: Number(pool.swapFee || '0'),
					x1: new BigNumber(
						pool.poolAssets.find(
							(poolAsset) => poolAsset.token.denom === tokenInDenom,
						)?.token.amount!,
					),
					y1: new BigNumber(
						pool.poolAssets.find(
							(poolAsset) => poolAsset.token.denom === targetTokenOutDenom,
						)?.token.amount!,
					),
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
				const base = pool.poolAssets[BASE_ASSET_INDEX]
				const quote = pool.poolAssets[QUOTE_ASSET_INDEX]

				// We have no garauntee that index [0] will be the token in so we need to calculate that ourselves
				const tokenOut = tokenInDenom === base.token.denom ? quote : base
				const tokenIn = tokenOut === base ? quote! : base!

				const nextHop: RouteHop = {
					poolId: pool.id,
					tokenInDenom,
					tokenOutDenom: tokenOut.token.denom,
					swapFee: Number(pool.swapFee || 0),
					x1: new BigNumber(tokenIn.token.amount),
					y1: new BigNumber(tokenOut.token.amount),
				}

				// deep copy so we don't mess up other links in the search
				const newRoute: RouteHop[] = JSON.parse(JSON.stringify(route))

				newRoute.push(nextHop)

				this.buildRoutesForTrade(
					tokenOut.token.denom!,
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
