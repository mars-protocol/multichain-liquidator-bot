import { Coin } from '@cosmjs/amino'

export interface PoolAsset {
	token: Coin
}
export enum PoolType {
	CONCENTRATED_LIQUIDITY = 'concentrated',
	XYK = 'xyk',
	STABLESWAP = 'stable',
}

export interface Pool {
	address: string
	id: Long
	swapFee: string
	poolType: PoolType
	token0: string;
	token1: string;
}

export interface XYKPool extends Pool {
	poolAssets: PoolAsset[]
}

export interface ConcentratedLiquidityPool extends Pool { 
	incentives_address: string;
	spread_rewards_address: string;
	current_tick_liquidity: string;
	current_sqrt_price: string;
	current_tick: string;
	tick_spacing: string;
	exponent_at_price_one: string;
	spread_factor: string;
	last_liquidity_update: string;
}

export interface Pagination {
	nextKey: string
	total: number
}
