import { RouteHop } from "./RouteHop";
export interface AstroportApiRoute {
    id: string;
    swaps: Swap[];
    denom_in: string;
    decimals_in: number;
    price_in: number;
    value_in: string;
    amount_in: string;
    denom_out: string;
    decimals_out: number;
    price_out: number;
    value_out: string;
    amount_out: string;
    price_difference: number;
}
export interface Swap {
    contract_addr: string;
    from: string;
    to: string;
    type: string;
    illiquid: boolean;
}
export declare const toRouteHopArray: (astroRoute: AstroportApiRoute) => RouteHop[];
