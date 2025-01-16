// import { RouteHop } from "./RouteHop";

import { PoolType } from './Pool'
import { RouteHop } from './RouteHop'

export interface AstroportApiRoute {
	id: string
	swaps: Swap[]
	denom_in: string
	decimals_in: number
	price_in: number
	value_in: string
	amount_in: string
	denom_out: string
	decimals_out: number
	price_out: number
	value_out: string
	amount_out: string
	price_difference: number
}

export interface Swap {
	contract_addr: string
	from: string
	to: string
	type: string
	illiquid: boolean
}

export const toRouteHopArray = (astroRoute: AstroportApiRoute): RouteHop[] => {
	return astroRoute.swaps.map((swap) => {
		return {
			poolId: 0 as any as Long,
			tokenInDenom: astroRoute.denom_in,
			tokenOutDenom: astroRoute.denom_out,
			pool: {
				token0: swap.from,
				token1: swap.to,
				id: 0 as any,
				swapFee: '0.003',
				address: swap.contract_addr,
				poolType: PoolType.XYK,
			},
		}
	})
}
