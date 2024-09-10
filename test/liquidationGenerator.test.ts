import BigNumber from 'bignumber.js'
import { getLargestCollateral, getLargestDebt } from '../src/liquidationGenerator'
import { Collateral, Debt } from '../src/query/types'
import { generateRandomAsset } from './testHelpers'

describe('Liquidation Tx Generator Tests..', () => {
	test('Can get largest colallateral correctly', () => {
		const collateralA: Collateral = { ...generateRandomAsset(), enabled: true }
		const collateralB: Collateral = { ...generateRandomAsset(), enabled: true }
		const prices = new Map<string, BigNumber>()
		prices.set(collateralA.denom, new BigNumber(1))
		prices.set(collateralB.denom, new BigNumber(2))

		const assets = [collateralA, collateralB]
		const largestIndex = collateralA.amount > collateralB.amount ? 0 : 1
		const largestCollateral = getLargestCollateral(assets, prices)
		expect(largestCollateral).toBe(assets[largestIndex].denom)
	}),
		test('Can get largest debt correctly', () => {
			const debtA: Debt = { ...generateRandomAsset(), uncollateralised: false }
			const debtB: Debt = { ...generateRandomAsset(), uncollateralised: false }
			const prices = new Map<string, BigNumber>()
			prices.set(debtA.denom, new BigNumber(1))
			prices.set(debtB.denom, new BigNumber(2))
			const assets = [debtA, debtB]
			const largestIndex = debtA.amount > debtB.amount ? 0 : 1
			const largestCollateral = getLargestDebt(assets, prices).denom

			expect(largestCollateral).toBe(assets[largestIndex].denom)
		})
})
