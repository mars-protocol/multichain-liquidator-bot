/**
 * Generic route interface that can work with any routing service
 */
export interface GenericRoute {
	amountIn: string
	estimatedAmountOut: string
	operations: Array<{
		chainId: string
		steps: Array<{
			venue: string
			denomIn: string
			denomOut: string
			pool?: string
		}>
	}>
}

/**
 * Route requester requests a route from an endpoint that is often an off chain source,
 * that provides a route for a given tokenIn and tokenOut. This is often a more reliable
 * and lower maintainance way of getting routes that using AMM routing and supporting every
 * possible pool type on the various chains.
 */
export abstract class RouteRequester {
	apiUrl: string

	constructor(apiUrl: string) {
		this.apiUrl = apiUrl
	}

	/**
	 * Generic route method that returns a standardized route format
	 */
	abstract getRoute(params: {
		denomIn: string
		denomOut: string
		amountIn: string
		chainIdIn: string
		chainIdOut: string
	}): Promise<GenericRoute>
}
