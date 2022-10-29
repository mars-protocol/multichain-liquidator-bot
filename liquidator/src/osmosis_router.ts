import { OsmosisApiClient } from "@cosmology/core/types/clients/osmosis";
import { CoinDenom, getPricesFromCoinGecko, makePoolPairs, makePoolsPretty, osmoDenomToSymbol, PrettyPair, PrettyPool, TradeRoute, CoinSymbol } from "cosmology";



/**
 * Responsible for 
 */
class OsmosisRouter {
    private lcdApi : OsmosisApiClient
    private pools: PrettyPool[] 
    constructor(lcdUrl: string) {
        this.lcdApi = new OsmosisApiClient({
            url: lcdUrl
          });

        this.pools = []
    }

    async init() : Promise<boolean> {
        const prices = await getPricesFromCoinGecko();
        this.pools = makePoolsPretty(prices, (await this.lcdApi.getPools()).pools)

        return true
    }

    getRoute(tokenInDenom: string, tokenOutDenom: string, amount: string) : TradeRoute[] {
        return this.lookupRoutesForTrade(tokenInDenom, tokenOutDenom, makePoolPairs(this.pools))
    }

    lookupRoutesForTrade(tokenInDenom: string, tokenOutDenom:string, pairs: PrettyPair[]): TradeRoute[] {
        const directPool = pairs.find(
          (pair) =>
            (pair.base_address == tokenInDenom &&
              pair.quote_address == tokenOutDenom) ||
            (pair.quote_address == tokenInDenom &&
              pair.base_address == tokenOutDenom)
        )
      
        if (directPool) {
          return [
            {
              poolId: directPool.id,
              tokenOutDenom: tokenOutDenom,
              tokenOutSymbol: osmoDenomToSymbol(tokenOutDenom),
              tokenInSymbol: osmoDenomToSymbol(tokenInDenom),
              liquidity: directPool.liquidity
            }
          ]
        }
      
        // all pairs that have our sell asset
        const possibleStartingPairs = pairs.filter((pair)=> pair.base_address === tokenInDenom || pair.quote_address === tokenInDenom)

        // for each starting pair, find the denom that is not our sell denom and try find a pool with it
        const routeOptions : TradeRoute[][] = possibleStartingPairs.map((pair) => {
            const useableDenom = pair.base_address === tokenInDenom ? pair.quote_address : pair.base_address
            return this.routeThroughPool(useableDenom, tokenInDenom, tokenOutDenom, pairs)
        })

        if (!routeOptions) {
            throw new Error('no trade routes found!');
        }
        // for each route, check liqudity
        // map each route into the smallest liqudiity - in dollars
        // return the max of this
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
     * @param pairs Available pairs on the given osmosis network
     * @returns A multihop route through the given hop denom, or and empty route if no such route exists
     */
    routeThroughPool(hopDenom: CoinDenom, tokenInDenom: string, tokenOutDenom: string, pairs: PrettyPair[] ): TradeRoute[] {
        const symbol : CoinSymbol = osmoDenomToSymbol(hopDenom) 
      
        const sellPool = pairs.find(
          (pair) =>
            (pair.base_address == tokenInDenom && pair.quote_address == hopDenom) ||
            (pair.quote_address == tokenInDenom && pair.base_address == hopDenom)
        )
      
        const buyPool = pairs.find(
          (pair) =>
            (pair.base_address == hopDenom && pair.quote_address == tokenOutDenom) ||
            (pair.quote_address == hopDenom && pair.base_address == tokenOutDenom)
        )
      
        if (sellPool && buyPool) {
          const routes = [
            {
              poolId: sellPool.id,
              tokenOutDenom: hopDenom,
              tokenOutSymbol: symbol,
              tokenInSymbol: osmoDenomToSymbol(tokenInDenom),
              liquidity: sellPool.liquidity
            },
            {
              poolId: buyPool.id,
              tokenOutDenom: tokenOutDenom,
              tokenOutSymbol: osmoDenomToSymbol(tokenOutDenom),
              tokenInSymbol: symbol,
              liquidity: buyPool.liquidity
            }
          ];
      
          return routes;
        }

        return []
      }

}