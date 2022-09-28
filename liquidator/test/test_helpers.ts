import { Asset } from '../src/types/asset'
import { Position } from '../src/types/position'

export const generateRandomAsset = (): Asset => {
  return {
    denom: Math.random().toString(),
    amount: Math.random(),
  }
}

export const generateRandomPosition = (): Position => {
  return {
    address: Math.random().toString(),
    collaterals: [generateRandomAsset(), generateRandomAsset()],
    debts: [generateRandomAsset(), generateRandomAsset()],
  }
}
