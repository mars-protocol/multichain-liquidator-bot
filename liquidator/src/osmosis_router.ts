import { 
  CoinDenom
} from "cosmology";
import { osmosis } from "osmojs";
import { Pool } from "osmojs/types/codegen/osmosis/gamm/pool-models/balancer/balancerPool";

const BASE_ASSET_INDEX = 0
const QUOTE_ASSET_INDEX = 1

/**
 * Router provides a route to swap between any two given assets.
 * 
 */
export class OsmosisRouter {
    private rpcEndpoint: string 
    private pools: Pool[] 
    constructor(rpcEndpoint: string) {
        this.rpcEndpoint = rpcEndpoint
        this.pools = []
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

    getRoute(tokenInDenom: string, tokenOutDenom: string) : OsmosisRouteHop[] {
        return this.lookupRoutesForTrade(tokenInDenom, tokenOutDenom, this.pools)
    }

    private lookupRoutesForTrade(tokenInDenom: string, tokenOutDenom:string, pools: Pool[]): OsmosisRouteHop[] {
       
      const directPool = pools.find(
          (pool) =>
            (pool.poolAssets[BASE_ASSET_INDEX].token?.denom === tokenInDenom &&
              pool.poolAssets[QUOTE_ASSET_INDEX].token?.denom === tokenOutDenom) ||
            (pool.poolAssets[QUOTE_ASSET_INDEX].token?.denom === tokenInDenom &&
              pool.poolAssets[BASE_ASSET_INDEX].token?.denom === tokenOutDenom)
        )
      
        if (directPool) {
          return [
            {
              poolId: directPool.id,
              tokenIn: tokenInDenom,
              tokenOut: tokenOutDenom
            }
          ]
        }
      
        // all pairs that have our sell asset
        const possibleStartingPairs = pools.filter(
            (pool) => pool.poolAssets[BASE_ASSET_INDEX].token?.denom === tokenInDenom || 
              pool.poolAssets[QUOTE_ASSET_INDEX].token?.denom === tokenInDenom)

        // for each starting pair, find the denom that is not our sell denom and try find a pool with it
        const routeOptions : OsmosisRouteHop[][] = possibleStartingPairs.map((pair) => {
            const baseAssetAddress = pair.poolAssets[BASE_ASSET_INDEX].token?.denom
            const quoteAssetAddress = pair.poolAssets[QUOTE_ASSET_INDEX].token?.denom

            if (!baseAssetAddress || !quoteAssetAddress) {
              return []
            }
            const useableDenom = baseAssetAddress === tokenInDenom ? quoteAssetAddress : baseAssetAddress
            return this.routeThroughPool(useableDenom, tokenInDenom, tokenOutDenom, pools)
        })

        if (!routeOptions) {
            throw new Error('no trade routes found!')
        }

        // TODO - return the route with the best liqudity
        routeOptions[0]
        return routeOptions[0]
    }

    /**
     * Finds a multi hop route through an intermediary pool, or returns an empty list if no route is found.
     * 
     * Useful if you want to swap Asset A to B have no direct pool with a A:B, as it confirms a route for a given
     * hop token denom, e.g [A:hopDenom, hopDenom:B] to swap A->B.
     * @param hopDenom The denom used to hop through.
     * @param tokenInDenom The denom of the asset we are selling
     * @param tokenOutDenom The denom of the asset we are buying
     * @param pools Available pairs on the given osmosis network
     * @returns A multihop route through the given hop denom, or and empty route if no such route exists
     */
    private routeThroughPool(hopDenom: CoinDenom, tokenInDenom: string, tokenOutDenom: string, pools: Pool[] ): OsmosisRouteHop[] {
      
        const sellPool = pools.find(
          (pool) =>
            (pool.poolAssets[BASE_ASSET_INDEX].token?.denom == tokenInDenom && pool.poolAssets[QUOTE_ASSET_INDEX].token?.denom == hopDenom) ||
            (pool.poolAssets[QUOTE_ASSET_INDEX].token?.denom == tokenInDenom && pool.poolAssets[BASE_ASSET_INDEX].token?.denom == hopDenom)
        )
      
        const buyPool = pools.find(
          (pool) =>
            (pool.poolAssets[BASE_ASSET_INDEX].token?.denom == hopDenom && pool.poolAssets[QUOTE_ASSET_INDEX].token?.denom == tokenOutDenom) ||
            (pool.poolAssets[QUOTE_ASSET_INDEX].token?.denom == hopDenom && pool.poolAssets[BASE_ASSET_INDEX].token?.denom == tokenOutDenom)
        )
      
        if (sellPool && buyPool) {
          const routes = [
            {
              poolId: sellPool.id,
              tokenIn: tokenInDenom,
              tokenOut: tokenOutDenom,
            },
            {
              poolId: buyPool.id,
              tokenIn: tokenInDenom,
              tokenOut: tokenOutDenom,
            }
          ];
      
          return routes;
        }

        return []
      }

}