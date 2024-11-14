import { Pool } from './Pool'

export interface RouteHop {
	poolId: Long
	tokenInDenom: string
	tokenOutDenom: string
	pool: Pool
}
