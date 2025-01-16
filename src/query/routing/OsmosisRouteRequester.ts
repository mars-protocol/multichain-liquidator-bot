import Long from 'long'
import { RouteHop } from '../../types/RouteHop'
import { RequestRouteResponse, RouteRequester } from './RouteRequesterInterface'
import { RouteResponse } from '../../types/OsmosisRouteResponse'
import { PoolType } from '../../types/Pool'
import BigNumber from 'bignumber.js'

export class OsmosisRouteRequester extends RouteRequester {
	async requestRoute(
		tokenInDenom: string,
		tokenOutDenom: string,
		tokenInAmount: string,
	): Promise<RequestRouteResponse> {
		let url = `${this.apiUrl}/router/quote?tokenIn=${tokenInAmount}${tokenInDenom}&tokenOutDenom=${tokenOutDenom}`

		const response = await fetch(url)

		if (response.ok === false) {
			throw new Error(`Failed to fetch route: ${response.statusText}, ${url}`)
		}

		let routeResponse: RouteResponse = await response.json()

		let route = routeResponse.route[0].pools.map((pool) => {
			let routeHop: RouteHop = {
				poolId: new Long(pool.id),
				tokenInDenom: tokenInDenom,
				tokenOutDenom: pool.token_out_denom,
				pool: {
					address: 'notrequired',
					id: new Long(pool.id),
					poolType: PoolType.XYK,
					swapFee: pool.spread_factor,
					token0: tokenInDenom,
					token1: pool.token_out_denom,
				},
			}
			tokenInDenom = pool.token_out_denom
			return routeHop
		})

		// allow for 2.5% slippage from what we estimated
		const minOutput = new BigNumber(routeResponse.amount_out).multipliedBy(0.975).toFixed(0)

		return {
			route,
			expectedOutput: minOutput,
		}
	}
}
