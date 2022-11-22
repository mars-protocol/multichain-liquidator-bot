import BigNumber from "bignumber.js";
import { osmosis } from "osmojs";
import { Pool } from "osmojs/types/codegen/osmosis/gamm/pool-models/balancer/balancerPool";
import { RouteHop } from "./types/OsmosisRouteHop";

const BASE_ASSET_INDEX = 0
const QUOTE_ASSET_INDEX = 1

export interface OsmosisRouterInterface {
  init(): Promise<boolean>
  getRoutes(tokenInDenom: string, tokenOutDenom: string) : RouteHop[][]
}

/**
 * Router provides a route to swap between any two given assets.
 * 
 */
export class OsmosisRouter implements OsmosisRouterInterface {
    private rpcEndpoint: string 
    private pools: Pool[] 
    constructor(rpcEndpoint: string) {
        this.rpcEndpoint = rpcEndpoint
        this.pools = []
    }

    setPools(pools: Pool[]) {
      this.pools = pools
    }

    // Instantiate our pools 
    async init() : Promise<boolean> {
        const client = await osmosis.ClientFactory.createRPCQueryClient({ rpcEndpoint:this.rpcEndpoint })
        const poolResponse = await client.osmosis.gamm.v1beta1.pools()

        this.pools = poolResponse.pools.map(({ value }) => {
          return osmosis.gamm.v1beta1.Pool.decode(value);
        });
        return true
    }

    getSwapCost(tokenInDenom : string, tokenOutDenom: string, tokenInAmount: number) {
      const route = this.getRoutes(tokenInDenom, tokenOutDenom)
      let totalCostBp = 0
      route.forEach((hop)=> {
        // todo
      })
    }

    getRoutes(tokenInDenom: string, tokenOutDenom: string) : RouteHop[][] {
        return this.buildRoutesForTrade(tokenInDenom, tokenOutDenom, this.pools, [], [])
    }

    // We want to list all assets in the route except our last denom (tokenOutDenom)
    private findUsedPools = (route : RouteHop[]) : Long[] => {
      return route.map((hop) => hop.poolId)
    }

    private buildRoutesForTrade(
      tokenInDenom: string, 
      targetTokenOutDenom:string, 
      pools: Pool[], 
      route : RouteHop[], 
      routes: RouteHop[][]): RouteHop[][] {
      
        // we don't want to search through the same pools again and loop, so we delete filter pools that 
        // exist in the route
        const usedPools = this.findUsedPools(route)
        // all pairs that have our sell asset, and are not previously in our route
        const possibleStartingPairs = pools.filter(
          (pool) => (
            pool.poolAssets[BASE_ASSET_INDEX].token?.denom === tokenInDenom || 
            pool.poolAssets[QUOTE_ASSET_INDEX].token?.denom === tokenInDenom) 
            // ensure we don't use an asset we are already routing through
            && !usedPools.find((poolId)=> poolId === pool.id))

        // no more possible pools then we exit
        if (possibleStartingPairs.length === 0) return []

        // if we find an ending par(s), we have found the end of our route
        const endingPairs = possibleStartingPairs.filter(
          (pool) => pool.poolAssets[BASE_ASSET_INDEX].token?.denom === targetTokenOutDenom ||
            pool.poolAssets[QUOTE_ASSET_INDEX].token?.denom === targetTokenOutDenom)
      
        if (endingPairs.length > 0) {
          endingPairs.forEach((pool) => {
            const hop  : RouteHop = {
              poolId: pool.id,
              tokenInDenom: tokenInDenom,
              tokenOutDenom: targetTokenOutDenom,
              swapFee: Number(pool.poolParams?.swapFee || '0'),
              x1 : new BigNumber(pool.poolAssets.find((poolAsset)=>poolAsset.token?.denom===tokenInDenom)?.token?.amount!),
              y1 : new BigNumber(pool.poolAssets.find((poolAsset)=>poolAsset.token?.denom===targetTokenOutDenom)?.token?.amount!)
            }

            const routeClone = {...route}
            routeClone.push(hop)
            routes.push(routeClone)
          })
          return routes
        }
      
        // Else, we have not found the route. Iterate recursively through the pools building valid routes. 
        possibleStartingPairs.forEach((pool) => {
          const base = pool.poolAssets[BASE_ASSET_INDEX].token!
          const quote = pool.poolAssets[QUOTE_ASSET_INDEX].token!

          // We have no garauntee that index [0] will be the token in so we need to calculate that ourselves
          const tokenOut = tokenInDenom === base.denom ? quote : base
          const tokenIn = tokenOut === base ? quote! : base!

          const nextHop : RouteHop = {
            poolId:pool.id,
            tokenInDenom,
            tokenOutDenom: tokenOut.denom,
            swapFee: Number(pool.poolParams?.swapFee || 0),
            x1 : new BigNumber(tokenIn.amount),
            y1 : new BigNumber(tokenOut.amount)
          }

          // deep copy so we don't mess up other links in the search
          const newRoute = {...route}

          newRoute.push(nextHop)

          this.buildRoutesForTrade(tokenOut.denom!, targetTokenOutDenom, pools, newRoute, routes)
        })

        return routes
    }

   

}