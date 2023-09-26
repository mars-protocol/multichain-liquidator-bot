export interface SwapperRoute {
	denom_in: string
	denom_out: string
	route: SwapperRouteHop[]
}

export interface SwapperRouteHop {
	pool_id: number | string
	token_out_denom: string
}
