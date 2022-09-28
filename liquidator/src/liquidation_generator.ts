import { Asset } from './types/asset.js'
import { Position } from './types/position.js'
import { LiquidationTx } from './types/liquidation.js'

/**
 * Generate a simple liquidation tx for a position.
 *
 * Note that if a position has mutiple debts and collaterals, it will chose the largest of each by raw amount.
 * This is a somewhat limited approach, as this may not reflect close to the USD value of the collateral
 * or debt. While suboptimal, this is not unsafe as in the case of a smaller debt being repaid or collateral
 * claimed, we will just liquidate again in a couple blocks if it is still unhealthy. Redbank gracefully
 * handles situations where collateral requested has a value less than the debt being repaid, so this is also
 * safe
 *
 * @param position The unhealthy position to be liquidated
 * @returns A liquidation transaction for the given position.
 */
export const createLiquidationTx = (position: Position): LiquidationTx => {
  const debtAsset = getLargestDebt(position.debts)

  return {
    collateral_denom: getLargestCollateral(position.collaterals),
    debt_denom: debtAsset.denom,
    user_address: position.address,
    amount: debtAsset.amount.toFixed(0),
  }
}

// Sort asset array from highest amount to lowest
const sortAssetArrayByAmount = (assets: Asset[]): Asset[] => {
  // deep copy, so we don't mess up the og array.
  const assetClone = [...assets]
  return assetClone.sort((a: Asset, b: Asset) => a.amount - b.amount).reverse()
}

export const getLargestCollateral = (collaterals: Asset[]): string => {
  return sortAssetArrayByAmount(collaterals)[0].denom
}

export const getLargestDebt = (debts: Asset[]): Asset => {
  return sortAssetArrayByAmount(debts)[0]
}
