import { OsmosisApiClient } from "@cosmology/core/types/clients/osmosis";
import { CoinDenom, getPricesFromCoinGecko, LcdPool, makePoolPairs, makePoolsPretty, osmoDenomToSymbol, PrettyPair, PrettyPool, prettyPool, TradeRoute } from "cosmology";
type CoinSymbol =
    'ATOM' |
    'OSMO' |
    'ION' |
    'AKT' |
    'DVPN' |
    'IRIS' |
    'CRO' |
    'XPRT' |
    'REGEN' |
    'IOV' |
    'NGM' |
    'EEUR' |
    'JUNO' |
    'LIKE' |
    'USTC' |
    'LUNC' |
    'BCNA' |
    'SCRT' |
    'MED'

export interface CoinValue {
    denom: string,
    amount: string
}

export interface Trade {
    sell: CoinValue;
    buy: CoinValue;
    beliefValue: string;
}

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
        // todo for each route option, check liquidity
        return routeOptions[0]

    }

    routeThroughPool(denom: CoinDenom, tokenInDenom: string, tokenOutDenom: string, pairs: PrettyPair[] ): TradeRoute[] {
        const symbol : CoinSymbol = osmoDenomToSymbol(denom) 
      
        const sellPool = pairs.find(
          (pair) =>
            (pair.base_address == tokenInDenom && pair.quote_address == denom) ||
            (pair.quote_address == tokenInDenom && pair.base_address == denom)
        )
      
        const buyPool = pairs.find(
          (pair) =>
            (pair.base_address == denom && pair.quote_address == tokenOutDenom) ||
            (pair.quote_address == denom && pair.base_address == tokenOutDenom)
        )
      
        if (sellPool && buyPool) {
          const routes = [
            {
              poolId: sellPool.id,
              tokenOutDenom: denom,
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