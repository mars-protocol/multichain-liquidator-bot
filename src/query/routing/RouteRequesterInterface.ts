import { RouteHop } from '../../types/RouteHop'
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

	abstract requestRoute(
		tokenInDenom: string,
		tokenOutDenom: string,
		tokenInAmount: string,
	): Promise<RequestRouteResponse>
}

export interface RequestRouteResponse {
	route: RouteHop[]
	expectedOutput: string
}
