export interface AmountIn {
	denom: string
	amount: string
}

export interface PoolBalance {
	denom: string
	amount: string
}

export interface Pool {
	id: number
	type: number
	balances: PoolBalance[]
	spread_factor: string
	token_out_denom: string
	taker_fee: string
	code_id: number
}

export interface Route {
	pools: Pool[]
	'has-cw-pool': boolean
	out_amount: string
	in_amount: string
}

export interface RouteResponse {
	amount_in: AmountIn
	amount_out: string
	route: Route[]
	effective_fee: string
	price_impact: string
	in_base_out_quote_spot_price: string
}
