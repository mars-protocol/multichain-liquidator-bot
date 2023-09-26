import { Int } from "@keplr-wallet/unit";
import { camelCaseKeys } from "../../helpers";
import { ConcentratedLiquidityPool, Pool, PoolType, StableswapPool as StableswapPool, XYKPool } from "../../types/Pool";
import { PoolDataProviderInterface } from "./PoolDataProviderInterface";
import { LiquidityDepth } from "../../amm/osmosis/math/concentrated/types";

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
	
				// clear any residual pools from errored attemps etc
				pools = []

				responseJson.pools.forEach((data: any) => {
					if (data['@type'] === '/osmosis.concentratedliquidity.v1beta1.Pool') {
					  const result =  camelCaseKeys(data) as ConcentratedLiquidityPool;
					  result.poolType = PoolType.CONCENTRATED_LIQUIDITY
					  pools.push(result)
					} else if (data['@type'] === '/osmosis.gamm.v1beta1.Pool') {
						const result = camelCaseKeys(data) as XYKPool
						result.poolType = PoolType.XYK
						result.token0 = result.poolAssets[0].token.denom
						result.token1 = result.poolAssets[1].token.denom
						result.swapFee = data.pool_params.swap_fee
						pools.push(result)
					} else if (data['@type'] === '/osmosis.gamm.poolmodels.stableswap.v1beta1.Pool') {
						const result = camelCaseKeys(data) as StableswapPool
						result.poolType = PoolType.STABLESWAP
						result.token0 = result.poolLiquidity[0].denom
						result.token1 = result.poolLiquidity[1].denom
						pools.push(result)
					}
				  });
	
				fetched = true
			} catch {
				retryCount++
				console.log('retrying fetch')
			}		
		}

		// append tick data.
		await Promise.all(pools
					.filter(pool => pool.poolType === PoolType.CONCENTRATED_LIQUIDITY)
					.map(pool => this.fetchTickData(pool as ConcentratedLiquidityPool))
				)

		return pools
	}

	private fetchTickData = async(pool : ConcentratedLiquidityPool) : Promise<ConcentratedLiquidityPool> => {
		const minTick = new Int(-162000000);
		const maxTick = new Int(342000000);
		// need to fetch token in and token out
		const zeroToOneTicksUrl = `${this.lcdEndpoint}/osmosis/concentratedliquidity/v1beta1/liquidity_net_in_direction?pool_id=${pool.id}&token_in=${pool.token0}&use_cur_tick=true&bound_tick=${minTick.toString()}`
		const oneToZeroTicksUrl = `${this.lcdEndpoint}/osmosis/concentratedliquidity/v1beta1/liquidity_net_in_direction?pool_id=${pool.id}&token_in=${pool.token1}&use_cur_tick=true&bound_tick=${maxTick.toString()}`

		const zeroToOneTicks = await this.fetchDepths(zeroToOneTicksUrl)
		const oneToZeroTicks = await this.fetchDepths(oneToZeroTicksUrl)

		pool.liquidityDepths = {
			zeroToOne: zeroToOneTicks,
			oneToZero: oneToZeroTicks
		}

		return pool
	}

	private fetchDepths = async(url : string) : Promise<LiquidityDepth[]> => {
		const responseJson = await this.sendRequest(url);
		if (responseJson.liquidity_depths) {
			return responseJson.liquidity_depths.map((depth: any) => camelCaseKeys(depth)) as LiquidityDepth[]
		}

		return []
		
	}

	private sendRequest = async (url: string) : Promise<any> => {
		const response = await fetch(url)
		return await response.json()
	}
}