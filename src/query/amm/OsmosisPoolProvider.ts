import { Dec, Int } from "@keplr-wallet/unit";
import { camelCaseKeys } from "../../helpers";
import { ConcentratedLiquidityPool, Pool, PoolType, StableswapPool as StableswapPool, XYKPool } from "../../types/Pool";
import { PoolDataProviderInterface } from "./PoolDataProviderInterface";
import { BigDec, LiquidityDepth, estimateInitialTickBound, } from "@osmosis-labs/math";

export class OsmosisPoolProvider implements PoolDataProviderInterface {

    constructor(private lcdEndpoint: string, private apiKey: string) {}

    loadPools = async (): Promise<Pool[]> => {
		let fetched = false
		let pools: Pool[] = []
		let retryCount = 0

		while (!fetched && retryCount < 5) {
			try {
				const response = await fetch(
					`${this.lcdEndpoint}/osmosis/poolmanager/v1beta1/all-pools?x-apikey=${this.apiKey}`,
				)
				const responseJson: any = await response.json()
				// clear any residual pools from errored attemps etc
				pools = []

				responseJson.pools.forEach((data: any) => {
					if (data['@type'] === '/osmosis.concentratedliquidity.v1beta1.Pool') {
					  const result =  camelCaseKeys(data) as ConcentratedLiquidityPool;
					  result.poolType = PoolType.CONCENTRATED_LIQUIDITY
					  // TODO: @piobab added to fix `Failed to find specified pool : 803`
					  //pools.push(result)
					} else if (data['@type'] === '/osmosis.gamm.v1beta1.Pool') {
						const result = camelCaseKeys(data) as XYKPool
						result.poolType = PoolType.XYK
						result.token0 = result.poolAssets[0].token.denom
						result.token1 = result.poolAssets[1].token.denom
						result.swapFee = data.pool_params.swap_fee

						// Currently don't use xyk for redbank
						if (process.env.EXECUTOR_TYPE?.toLowerCase() !== "redbank") {
							// TODO: fix xyk for certain pools
							pools.push(result)
						}

					} else if (data['@type'] === '/osmosis.gamm.poolmodels.stableswap.v1beta1.Pool') {
						const result = JSON.parse(JSON.stringify(camelCaseKeys(data))) as StableswapPool
						result.poolType = PoolType.STABLESWAP
						result.token0 = result.poolLiquidity[0].denom
						result.token1 = result.poolLiquidity[1].denom
						// TODO: @piobab added to fix `Failed to find specified pool : 803`
						// pools.push(result)
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
		return pools.filter(pool => (
			pool.poolType !== PoolType.CONCENTRATED_LIQUIDITY) ||
			((pool as ConcentratedLiquidityPool).liquidityDepths?.zeroToOne.length > 0 &&
			(pool as ConcentratedLiquidityPool).liquidityDepths?.oneToZero.length > 0)
		)}

	private fetchTickData = async(pool : ConcentratedLiquidityPool) : Promise<ConcentratedLiquidityPool> => {

		try {
			// get initial tick
			const initialMinTick = estimateInitialTickBound({
				specifiedToken: {
					denom: pool.token0,
					amount: new Int("100")
				},
				isOutGivenIn: true,
				token0Denom: pool.token0,
				token1Denom: pool.token1,
				currentSqrtPrice: new BigDec(pool.currentSqrtPrice),
				currentTickLiquidity: new Dec(pool.currentTickLiquidity)
				}).boundTickIndex

			const initialMaxTick = estimateInitialTickBound({
				specifiedToken: {
					denom: pool.token1,
					amount: new Int("100")
				},
				isOutGivenIn: true,
				token0Denom: pool.token0,
				token1Denom: pool.token1,
				currentSqrtPrice: new BigDec(pool.currentSqrtPrice),
				currentTickLiquidity: new Dec(pool.currentTickLiquidity)
				}).boundTickIndex
	
			// need to fetch token in and token out
			const zeroToOneTicksUrl = `${this.lcdEndpoint}/osmosis/concentratedliquidity/v1beta1/liquidity_net_in_direction?pool_id=${pool.id}&token_in=${pool.token0}&use_cur_tick=true&bound_tick=${initialMinTick.valueOf().toString()}&x-apikey=${this.apiKey}`
			const oneToZeroTicksUrl = `${this.lcdEndpoint}/osmosis/concentratedliquidity/v1beta1/liquidity_net_in_direction?pool_id=${pool.id}&token_in=${pool.token1}&use_cur_tick=true&bound_tick=${initialMaxTick.valueOf().toString()}&x-apikey=${this.apiKey}`
			const { depths: zeroToOneTicks } = await this.fetchDepths(zeroToOneTicksUrl)

			const {depths: oneToZeroTicks } = await this.fetchDepths(oneToZeroTicksUrl)

			pool.liquidityDepths = {
				zeroToOne: zeroToOneTicks,
				oneToZero: oneToZeroTicks
			}
		} catch(ex) {
			console.error('Error fetching tick data')
		}
		
		return pool
	}

	private fetchDepths = async(url : string) : Promise<{depths: LiquidityDepth[], currentTick: Int}> => {
		try {
			const responseJson = await this.sendRequest(url);
			const depths = responseJson.liquidity_depths.map((depth: any) => {
				return {
					tickIndex: new Int(depth.tick_index),
					netLiquidity: new Dec(depth.liquidity_net),
				}
			})

			const currentTick = new Int(responseJson.current_tick);
			return {
				depths,
				currentTick
			}

		} catch (ex) {
			console.error(ex)
		}

		return {depths: [], currentTick: new Int(0)}
	}

	private sendRequest = async (url: string) : Promise<any> => {
		const response = await fetch(url)
		return await response.json()
	}
}