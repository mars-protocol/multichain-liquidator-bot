import { RouteHop } from "../../types/RouteHop";
export interface RouteRequesterInterface {
    requestRoute(apiUrl: string, tokenInDenom: string, tokenOutDenom: string, tokenInAmount: string): Promise<RequestRouteResponse>;
}
export interface RequestRouteResponse {
    route: RouteHop[];
    expectedOutput: string;
}
