
import { Coin } from "@cosmjs/amino"
import { LiquidityDepth } from "@osmosis-labs/math"

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
	incentivesAddress: string;
	spreadRewardsAddress: string;
	currentTickLiquidity: string;
	currentSqrtPrice: string;
	currentTick: string;
	tickSpacing: string;
	exponentAtPriceOne: string;
	spreadFactor: string;
	lastLiquidityUpdate: string;
	liquidityDepths:{
		zeroToOne: LiquidityDepth[],
		oneToZero: LiquidityDepth[]
	}
}
  
 export interface Data {
	liquidityDepths: LiquidityDepth[];
	currentTick: string;
	currentLiquidity: string;
  }

export interface Pagination {
	nextKey: string
	total: number
}
