import { RouteRequester, GenericRoute } from './RouteRequesterInterface'
import { RouteResponse } from '../../types/OsmosisRouteResponse'
import BigNumber from 'bignumber.js'

export class OsmosisRouteRequester extends RouteRequester {
	async getRoute(params: {
		denomIn: string
		denomOut: string
		amountIn: string
		chainIdIn: string
		chainIdOut: string
	}): Promise<GenericRoute> {
		let url = `${this.apiUrl}/router/quote?tokenIn=${params.amountIn}${params.denomIn}&tokenOutDenom=${params.denomOut}`

		const response = await fetch(url)

		if (response.ok === false) {
			throw new Error(`Failed to fetch route: ${response.statusText}, ${url}`)
		}

		let routeResponse: RouteResponse = await response.json()

		// Convert Osmosis route to GenericRoute format
		const steps = routeResponse.route[0].pools.map((pool) => ({
			venue: 'osmosis',
			denomIn: params.denomIn,
			denomOut: pool.token_out_denom,
			pool: pool.id.toString(),
		}))

		// allow for 2.5% slippage from what we estimated
		const minOutput = new BigNumber(routeResponse.amount_out).multipliedBy(0.975).toFixed(0)

		return {
			amountIn: params.amountIn,
			estimatedAmountOut: minOutput,
			operations: [
				{
					chainId: params.chainIdIn,
					steps,
				},
			],
		}
	}
}
