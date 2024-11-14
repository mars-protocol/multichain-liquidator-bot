import { RequestRouteResponse, RouteRequester } from './RouteRequesterInterface'

export class OsmosisRouteRequester extends RouteRequester {
	requestRoute(
		//@ts-ignore
		tokenInDenom: string,
		//@ts-ignore
		tokenOutDenom: string,
		//@ts-ignore
		tokenInAmount: string,
	): Promise<RequestRouteResponse> {
		throw new Error('Method not implemented.')
	}
}
