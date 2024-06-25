import { Coin } from '@cosmjs/amino'
import { LiquidityDepth } from '@osmosis-labs/math/build/pool/concentrated/types'

export interface PoolAsset {
	token: Coin
}
export enum PoolType {
	CONCENTRATED_LIQUIDITY = 'concentrated',
	XYK = 'xyk',
	STABLESWAP = 'stable',
	COSMWASM = "cosmwasm",
	UNSUPPORTED = "unsupported"
}

export const fromString = (poolType: String): PoolType => {
	switch(poolType) {
		case "concentrated_liquidity": return PoolType.CONCENTRATED_LIQUIDITY
		case "xyk": return PoolType.XYK
		case "stableswap": return PoolType.STABLESWAP
		case "cosmwasm": return PoolType.COSMWASM
		default: return  PoolType.UNSUPPORTED
	}
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

export interface StableswapPool extends Pool {
    poolParams: {
      swapFee: string;
      exitFee: string;
    };
    futurePoolGovernor: string;
    totalShares:Coin
    poolLiquidity: Coin[];
    scalingFactors: string[];
    scalingFactorController: string;
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
