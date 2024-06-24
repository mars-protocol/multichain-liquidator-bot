import { RouteHop } from "../types/RouteHop";
export interface Pool {
    id: number;
    type: number;
    balances: any[];
    spread_factor: string;
    token_out_denom: string;
    taker_fee: string;
}
export interface Route {
    pools: Pool[];
    'has-cw-pool': boolean;
    out_amount: string;
    in_amount: string;
}
export interface AmountIn {
    denom: string;
    amount: string;
}
export interface Response {
    amount_in: AmountIn;
    amount_out: string;
    route: Route[];
    effective_fee: string;
    price_impact: string;
}
export declare const getRoute: (baseUrl: string, amountIn: string, inDenom: string, outDenom: string) => Promise<RouteHop[]>;
