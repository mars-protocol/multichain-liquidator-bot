import { AssetResponse, Collateral, Debt } from './hive.js'
import BigNumber from 'bignumber.js'

// Sort asset array from highest amount to lowest
const sortAssetArrayByAmount = (
	assets: AssetResponse[],
	prices: Map<string, number>,
): AssetResponse[] => {
	// deep copy, so we don't mess up the og array.
	const assetClone = [...assets]
	return assetClone
		.sort((a: AssetResponse, b: AssetResponse) =>
			new BigNumber(a.amount)
				.multipliedBy(prices.get(a.denom) || 0)
				.minus(b.amount)
				.toNumber(),
		)
		.reverse()
}

export const getLargestCollateral = (
	collaterals: Collateral[],
	prices: Map<string, number>,
): string => {
	return sortAssetArrayByAmount(collaterals, prices)[0].denom
}

export const getLargestDebt = (debts: Debt[], prices: Map<string, number>): AssetResponse => {
	return sortAssetArrayByAmount(debts, prices)[0]
}
