import Long from "long";
import { RouteHop } from "../types/RouteHop";
import { fromString } from "../types/Pool";

export interface Pool {
    id: number;
    type: number;
    // TODO add more specific type
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

export const getRoute = async (baseUrl: string, amountIn: string, inDenom: string, outDenom: string): Promise<RouteHop[]> => {
  let url = `${baseUrl}/router/quote?tokenIn=${amountIn}${inDenom}&tokenOutDenom=${outDenom}`  
  const response = await fetch(url)
    if (response.ok === false) {

      throw new Error(`Failed to fetch route: ${response.statusText}, ${url}`)
    }
    let routeResponse : Response = await response.json()

    let route = routeResponse.route[0].pools.map((pool) => {
            let routeHop : RouteHop = {
                poolId: new Long(pool.id),
                tokenInDenom: inDenom,
                tokenOutDenom: pool.token_out_denom,
                pool: {
                    address: "todo",
                    id: new Long(pool.id),
                    poolType: fromString(pool.type.toString()), // todo
                    swapFee: pool.spread_factor,
                    token0: inDenom,
                    token1: pool.token_out_denom
                }
            }
            inDenom = pool.token_out_denom
            return routeHop
        });

    return route
}