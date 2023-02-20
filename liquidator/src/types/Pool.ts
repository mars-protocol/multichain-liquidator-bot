import { Coin } from '@cosmjs/amino'

export interface PoolAsset {
	token: Coin
}

export interface Pool {
	address: string
	id: Long
	swapFee: string
	poolAssets: PoolAsset[]
}

export interface Pagination {
	nextKey: string
	total: number
}
