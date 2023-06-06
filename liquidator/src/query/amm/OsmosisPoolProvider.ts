import { camelCaseKeys } from "../../helpers";
import { Pagination, Pool } from "../../types/Pool";
import { PoolDataProviderInterface } from "./PoolDataProviderInterface";

export class OsmosisPoolProvider implements PoolDataProviderInterface {

    constructor(private lcdEndpoint: string) {}

    loadPools = async (): Promise<Pool[]> => {
		let fetchedAllPools = false
		let nextKey = ''
		let pools: Pool[] = []
		let totalPoolCount = 0
		while (!fetchedAllPools) {
			const response = await fetch(
				`${this.lcdEndpoint}/osmosis/gamm/v1beta1/pools${nextKey}`,
			)
			const responseJson: any = await response.json()
			
			if (responseJson.pagination === undefined) {
				fetchedAllPools = true
				return pools
			}

			const pagination = camelCaseKeys(responseJson.pagination) as Pagination

			// osmosis lcd query returns total pool count as 0 after page 1 (but returns the correct count on page 1), so we need to only set it once
			if (totalPoolCount === 0) {
				totalPoolCount = pagination.total
			}

			const poolsRaw = responseJson.pools as Pool[]

			poolsRaw.forEach((pool) => pools.push(camelCaseKeys(pool) as Pool))

			nextKey = `?pagination.key=${pagination.nextKey}`
			if (pools.length >= totalPoolCount) {
				fetchedAllPools = true
			}
		}

		return pools
	}
}