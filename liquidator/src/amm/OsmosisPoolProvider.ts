import { camelCaseKeys } from "../helpers";
import { ConcentratedLiquidityPool, Pagination, Pool, PoolType, XYKPool } from "../types/Pool";
import { PoolDataProviderInterface } from "./PoolDataProviderInterface";

export class OsmosisPoolProvider implements PoolDataProviderInterface {

    constructor(private lcdEndpoint: string) {}

    loadPools = async (): Promise<Pool[]> => {
		let fetched = false
		let pools: Pool[] = []
		let retryCount = 0

		while (!fetched && retryCount < 5) {
			try {
				const response = await fetch(
					`${this.lcdEndpoint}/osmosis/poolmanager/v1beta1/all-pools`,
				)
				const responseJson: any = await response.json()
	
				pools = responseJson.pools.map((data: any) => {
					if (data['@type'] === '/osmosis.concentratedliquidity.v1beta1.Pool') {
					  const result =  camelCaseKeys(data) as ConcentratedLiquidityPool;
					  result.poolType = PoolType.CONCENTRATED_LIQUIDITY
					  return result
					} else if (data['@type'] === '/osmosis.gamm.v1beta1.Pool') {
						const result = camelCaseKeys(data) as XYKPool
						result.poolType = PoolType.XYK
						result.token0 = result.poolAssets[0].token.denom
						result.token1 = result.poolAssets[1].token.denom
						return result
					} else {
					  // just skip, 
					  console.log('unsupported pool type')
					}
				  });
	
				fetched = true
			} catch {
				retryCount++
				console.log('retrying fetch')
			}		
		}

		// fetch concentrated liquidity pools

		return pools
	}
}