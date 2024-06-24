import { RequestRouteResponse, RouteRequesterInterface } from "./RouteRequesterInterface";
export declare class AstroportRouteRequester implements RouteRequesterInterface {
    requestRoute(apiUrl: string, tokenInDenom: string, tokenOutDenom: string, tokenOutAmount: string): Promise<RequestRouteResponse>;
}
