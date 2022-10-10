import { AssetResponse } from '../src/hive'
import { Asset } from '../src/types/asset'
import { Position } from '../src/types/position'

export const generateRandomAsset = (): AssetResponse => {
  return {
    denom: Math.random().toString(),
    amount: Math.random().toFixed(0),
    amount_scaled: '0'
  }
}

export const generateRandomPosition = (): Position => {
  return {
    Address: Math.random().toString(),
  }
}
