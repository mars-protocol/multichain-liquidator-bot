import { AMMRouter } from '../../../src/AmmRouter'
import { LiquidationActionGenerator } from '../../../src/rover/LiquidationActionGenerator'
import { MarketInfo } from '../../../src/rover/types/MarketInfo'
import {
	generateRandomCreditLine,
	generateRandomCreditLineCap,
	generateRandomMarket,
} from './helpers'
import {
	Coin,
	Decimal,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import { Collateral, Debt, PositionType } from '../../../src/rover/types/RoverPosition'
import { PoolType, XYKPool } from '../../../src/types/Pool'
import Long from 'long'
import { NO_ROUTE_FOR_SWAP } from '../../../src/rover/constants/errors'

describe('Liquidation Actions generator Unit Tests', () => {
	const router: AMMRouter = new AMMRouter()
	const debtDenom = Math.random().toString()
	const collateralDenom = Math.random().toString()
	const otherDenom = Math.random().toString()

	const debtToRandomAssetPrice = 1.5

	const randomAssetAmount = 10000000000

	const poolA: XYKPool = {
		address: 'abc',
		id: new Long(Math.random() * 10000),
		token0:otherDenom,
		token1:debtDenom,
		poolType: PoolType.XYK,
		poolAssets: [
			{
				token: {
					denom: otherDenom,
					amount: randomAssetAmount.toString(),
				},
			},
			{
				token: {
					denom: debtDenom,
					amount: (randomAssetAmount * debtToRandomAssetPrice).toString(),
				},
			},
		],
		swapFee: '0.002',
	}

	router.setPools([poolA])

	describe('Test borrow action generation', () => {
		describe('Direct Borrow', () => {
			test('When we are liquid', () => {
				const markets: MarketInfo[] = []

				const liquidationActionGenerator = new LiquidationActionGenerator(router)
				const debtDenom = Math.random().toString()
				const debtToRepay = 200

				const collateralDenom = Math.random().toString()
				const collateralAmount = 500

				const collateral: Collateral = {
					type: PositionType.DEPOSIT,
					amount: collateralAmount,
					closeFactor: 0.5,
					denom: collateralDenom,
					price: 1.5,
					value: 1.5 * collateralAmount,
				}
				const debt: Debt = {
					amount: debtToRepay,
					denom: debtDenom,
					price: 1,
				}
				const market = generateRandomMarket(debtDenom)
				market.available_liquidity = debtToRepay * 1000
				markets.push(market)
				const borrowActions = liquidationActionGenerator.produceBorrowActions(
					debt,
					collateral,
					markets,
					[debt.denom, market.denom],
					[generateRandomCreditLine(debt.denom), generateRandomCreditLine(collateral.denom)],
					[generateRandomCreditLineCap(debt.denom), generateRandomCreditLineCap(collateral.denom)],
				)
				console.log(borrowActions)
				const borrowAction: { borrow: Coin } = borrowActions[0] as { borrow: Coin }
				expect(borrowActions.length).toBe(1)
				expect(borrowAction.borrow.amount).toBe(debtToRepay.toFixed(0))
				expect(borrowAction.borrow.denom).toBe(debtDenom)
			})

			test('When we are illiquid but > 50% ', () => {
				const markets: MarketInfo[] = []

				const liquidationActionGenerator = new LiquidationActionGenerator(router)
				const debtDenom = Math.random().toString()
				const debtToRepay = 200

				const collateralDenom = Math.random().toString()
				const collateralAmount = 500

				const collateral: Collateral = {
					type: PositionType.DEPOSIT,
					amount: collateralAmount,
					closeFactor: 0.5,
					denom: collateralDenom,
					price: 1.5,
					value: 1.5 * collateralAmount,
				}
				const debt: Debt = {
					amount: debtToRepay,
					denom: debtDenom,
					price: 1,
				}

				const market = generateRandomMarket(debtDenom)
				market.available_liquidity = debtToRepay / 1.5
				markets.push(market)
				const borrowActions = liquidationActionGenerator.produceBorrowActions(
					debt,
					collateral,
					markets,
					[debt.denom, market.denom],
					[generateRandomCreditLine(debt.denom), generateRandomCreditLine(collateral.denom)],
					[generateRandomCreditLineCap(debt.denom), generateRandomCreditLineCap(collateral.denom)],
				)
				console.log(borrowActions)
				const borrowAction: { borrow: Coin } = borrowActions[0] as { borrow: Coin }
				expect(borrowActions.length).toBe(1)
				expect(borrowAction.borrow.amount).toBe(((debtToRepay / 1.5) * 0.99).toFixed(0))
				expect(borrowAction.borrow.denom).toBe(debtDenom)
			})

			test('Correctly calculate repay amount based on collateral reserve factor', () => {
				const markets: MarketInfo[] = []

				const liquidationActionGenerator = new LiquidationActionGenerator(router)
				const debtDenom = Math.random().toString()
				const debtToRepay = 200

				const collateralDenom = Math.random().toString()
				const collateralAmount = 150
				const collateral: Collateral = {
					type: PositionType.DEPOSIT,
					amount: collateralAmount,
					closeFactor: 0.5,
					denom: collateralDenom,
					price: 2,
					value: collateralAmount * 2,
				}
				const debt: Debt = {
					amount: debtToRepay,
					denom: debtDenom,
					price: 1,
				}
				const market = generateRandomMarket(debtDenom)
				market.available_liquidity = debtToRepay * 1000
				markets.push(market)
				const borrowActions = liquidationActionGenerator.produceBorrowActions(
					debt,
					collateral,
					markets,
					[debt.denom, collateral.denom],
					[generateRandomCreditLine(debt.denom), generateRandomCreditLine(collateral.denom)],
					[generateRandomCreditLineCap(debt.denom), generateRandomCreditLineCap(collateral.denom)],
				)
				console.log(borrowActions)
				const borrowAction: { borrow: Coin } = borrowActions[0] as { borrow: Coin }
				expect(borrowActions.length).toBe(1)
				expect(borrowAction.borrow.amount).toBe((150).toFixed(0))
				expect(borrowAction.borrow.denom).toBe(debtDenom)
			})
		})

		describe('Indirect Borrow', () => {
			test('Debt asset unavailable', () => {
				const markets: MarketInfo[] = []

				const liquidationActionGenerator = new LiquidationActionGenerator(router)

				const debtToRepay = 200
				const collateralAmount = 500

				const collateral: Collateral = {
					type: PositionType.DEPOSIT,
					amount: collateralAmount,
					closeFactor: 0.5,
					denom: collateralDenom,
					price: 1.5,
					value: 1.5 * collateralAmount,
				}

				const debt: Debt = {
					amount: debtToRepay,
					denom: debtDenom,
					price: 1,
				}
				const market = generateRandomMarket(otherDenom)
				market.available_liquidity = debtToRepay * 1000

				markets.push(market)

				const borrowActions = liquidationActionGenerator.produceBorrowActions(
					debt,
					collateral,
					markets,
					[market.denom, debt.denom, collateral.denom],
					[generateRandomCreditLine(debt.denom), generateRandomCreditLine(collateral.denom)],
					[generateRandomCreditLineCap(debt.denom), generateRandomCreditLineCap(collateral.denom)],
				)
				const borrowAction: { borrow: Coin } = borrowActions[0] as { borrow: Coin }

				//@ts-ignore
				const swapAction: {
					swap_exact_in: {
						denom_out: string
						slippage: Decimal
					}
				} = borrowActions[1]

				expect(borrowActions.length).toBe(2)

				expect(Number(borrowAction.borrow.amount)).toBeGreaterThan(
					debtToRepay / debtToRandomAssetPrice,
				)
				expect(swapAction.swap_exact_in.denom_out).toBe(debtDenom)
				expect(borrowAction.borrow.denom).toBe(otherDenom)
			})

			test('Debt available but < 50% required liquidity', () => {
				const markets: MarketInfo[] = []

				const liquidationActionGenerator = new LiquidationActionGenerator(router)
				const debtToRepay = 200

				const collateralDenom = Math.random().toString()
				const collateralAmount = 500
				const collateral: Collateral = {
					type: PositionType.DEPOSIT,
					amount: collateralAmount,
					closeFactor: 0.5,
					denom: collateralDenom,
					price: 1.5,
					value: collateralAmount * 1.5,
				}
				const debt: Debt = {
					amount: debtToRepay,
					denom: debtDenom,
					price: 1,
				}

				const market = generateRandomMarket(debtDenom)
				market.available_liquidity = debtToRepay / 2.1
				markets.push(market)

				const market2 = generateRandomMarket(otherDenom)
				market2.available_liquidity = debtToRepay
				markets.push(market2)

				const borrowActions = liquidationActionGenerator.produceBorrowActions(
					debt,
					collateral,
					markets,
					[debt.denom, market.denom, market2.denom],
					[generateRandomCreditLine(debt.denom), generateRandomCreditLine(collateral.denom)],
					[generateRandomCreditLineCap(debt.denom), generateRandomCreditLineCap(collateral.denom)],
				)
				console.log(borrowActions)
				const borrowAction: { borrow: Coin } = borrowActions[0] as { borrow: Coin }
				expect(borrowActions.length).toBe(2)
				expect(borrowAction.borrow.denom).toBe(otherDenom)
			})

			test('If no swap route possible for borrow we throw error', () => {
				const markets: MarketInfo[] = []

				const liquidationActionGenerator = new LiquidationActionGenerator(router)
				const debtToRepay = 200
				const collateralAmount = 500

				const collateral: Collateral = {
					type: PositionType.DEPOSIT,
					amount: collateralAmount,
					closeFactor: 0.5,
					denom: 'does not exist',
					price: 1.5,
					value: collateralAmount * 1.5,
				}

				const debt: Debt = {
					amount: debtToRepay,
					denom: 'doesnotexist',
					price: 1,
				}

				expect(() => {
					liquidationActionGenerator.produceBorrowActions(
						debt,
						collateral,
						markets,
						[debtDenom],
						[generateRandomCreditLine(debt.denom), generateRandomCreditLine(collateral.denom)],
						[
							generateRandomCreditLineCap(debt.denom),
							generateRandomCreditLineCap(collateral.denom),
						],
					)
				}).toThrow(NO_ROUTE_FOR_SWAP)
			})
		})
	})
})
