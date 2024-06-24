import BigNumber from "bignumber.js";
import { AstroportApiRoute } from "../../types/AstroportApiRoute";
import { RequestRouteResponse, RouteRequesterInterface } from "./RouteRequesterInterface";
import { RouteHop } from "../../types/RouteHop";
import { PoolType } from "../../types/Pool";

export class AstroportRouteRequester implements RouteRequesterInterface {
    async requestRoute(
        apiUrl: string, 
        tokenInDenom: string,
        tokenOutDenom: string,
        tokenOutAmount: string,
        ): Promise<RequestRouteResponse> {
            // todo pass chain id in?
            let url = `${apiUrl}routes?start=${tokenInDenom}&end=${tokenOutDenom}&amount=${tokenOutAmount}&chainId=neutron-1&limit=5`
            console.log(url)
            let response = await fetch(url)

            let astroportRoutes: AstroportApiRoute[] = await response.json()

            let bestRoute = astroportRoutes
            .sort((a, b) => {
                let a_val = new BigNumber(a.value_out)
                let b_val = new BigNumber(b.value_out)
                return a_val.minus(b_val).toNumber()
            }).pop();
        
            if (!bestRoute) {
                throw new Error(`No route found for ${tokenInDenom} to ${tokenOutDenom}`)
            }

            let routeHops : RouteHop[] = bestRoute?.swaps.map((swap) => {
                return {
                    // We don't use pool id in astroport swaps
                    poolId: 0 as any as Long,
                    tokenInDenom: swap.from,
                    tokenOutDenom: swap.to,
                    pool: {
                        token0: swap.from,
                        token1: swap.to,
                        id: 0 as any,
                        swapFee: "0.003",
                        address: swap.contract_addr,
                        poolType: PoolType.XYK,
                    },
                }
            });

            // allow for 2.5% slippage from what we estimated
            const minOutput = new BigNumber(bestRoute.value_out)
                .multipliedBy(0.975)
                .toFixed(0)

            return {
                route: routeHops,
                expectedOutput: minOutput,
            }
    }
}

