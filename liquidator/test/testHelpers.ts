import { AssetResponse } from '../src/query/types'
import { Position } from '../src/types/position'

export const generateRandomAsset = (): AssetResponse => {
	return {
		denom: Math.random().toString(),
		amount: Math.random().toFixed(0),
		amount_scaled: '0',
	}
}

export const generateRandomPosition = (): Position => {
	return {
		Identifier: Math.random().toString(),
	}
}
