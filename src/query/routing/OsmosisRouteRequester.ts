import { RequestRouteResponse, RouteRequester } from "./RouteRequesterInterface";

export class OsmosisRouteRequester extends RouteRequester {
    // @ts-ignore todo before deploying update on osmosis
    requestRoute(tokenInDenom: string, tokenOutDenom: string, tokenInAmount: string): Promise<RequestRouteResponse> {
        throw new Error("Method not implemented.");
    }
}
