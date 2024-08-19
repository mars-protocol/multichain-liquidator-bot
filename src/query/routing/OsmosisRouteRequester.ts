import { RequestRouteResponse, RouteRequester } from "./RouteRequesterInterface";

export class OsmosisRouteRequester implements RouteRequester {
    // @ts-ignore todo before deploying update on osmosis
    requestRoute(apiUrl: string, tokenInDenom: string, tokenOutDenom: string, tokenInAmount: string): Promise<RequestRouteResponse> {
        throw new Error("Method not implemented.");
    }
}
