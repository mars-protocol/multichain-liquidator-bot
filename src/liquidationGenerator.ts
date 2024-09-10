
import BigNumber from 'bignumber.js'
import { AssetResponse, Collateral, Debt } from './query/types'

// Sort asset array from highest amount to lowest
const sortAssetArrayByAmount = (
	assets: AssetResponse[],
	prices: Map<string, BigNumber>,
): AssetResponse[] => {
	// deep copy, so we don't mess up the og array.
	const assetClone = [...assets]
	return assetClone
		.sort((a: AssetResponse, b: AssetResponse) =>
			new BigNumber(a.amount)
				.multipliedBy(prices.get(a.denom) || 0)
				.minus(new BigNumber(b.amount).multipliedBy(prices.get(b.denom) || 0))
				.toNumber(),
		).reverse()
}

export const getLargestCollateral = (
	collaterals: Collateral[],
	prices: Map<string, BigNumber>,
): Collateral => {
	return sortAssetArrayByAmount(collaterals, prices)[0] as Collateral
}

export const getLargestDebt = (debts: Debt[], prices: Map<string, BigNumber>): AssetResponse => {
	return sortAssetArrayByAmount(debts, prices)[0]
}
