import { RouteRequester, GenericRoute } from '../RouteRequesterInterface'
import { getSwapRoute, SwapRoute, Operation, SwapOperation } from './getSwapRoute'

export class SkipRouteRequester extends RouteRequester {
	constructor(apiUrl: string = 'https://api.skip.build') {
		super(apiUrl)
	}

	/**
	 * Generic route method using Skip API
	 */
	async getRoute(params: {
		denomIn: string
		denomOut: string
		amountIn: string
		chainIdIn: string
		chainIdOut: string
	}): Promise<GenericRoute> {
		try {
			const swapRoute = await getSwapRoute(
				params.denomIn,
				params.denomOut,
				params.amountIn,
				params.chainIdIn,
				params.chainIdOut,
			)
			return this.convertSkipRouteToGenericRoute(swapRoute)
		} catch (error) {
			if (error instanceof Error && error.message.includes('No swap route found')) {
				throw new Error(`No route found for ${params.denomIn} to ${params.denomOut}`)
			}
			throw error
		}
	}

	/**
	 * Convert Skip API response to GenericRoute format
	 */
	private convertSkipRouteToGenericRoute(skipRoute: SwapRoute): GenericRoute {
		if (!skipRoute.does_swap) {
			throw new Error('No swap route available')
		}

		const operations = skipRoute.operations.map((operation: Operation) => ({
			chainId: skipRoute.source_asset_chain_id,
			steps: operation.swap.swap_in.swap_operations.map((swapOp: SwapOperation) => ({
				venue: operation.swap.swap_in.swap_venue.name,
				denomIn: swapOp.denom_in,
				denomOut: swapOp.denom_out,
				pool: swapOp.pool,
			})),
		}))
		return {
			amountIn: skipRoute.amount_in,
			estimatedAmountOut: skipRoute.amount_out,
			operations,
		}
	}
}
