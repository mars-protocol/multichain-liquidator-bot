import BigNumber from 'bignumber.js'
import { Action, ActionCoin, Coin } from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import { RouteRequester } from '../../../src/query/routing/RouteRequesterInterface'
import { ActionGenerator } from '../../../src/rover/ActionGenerator'
import {
	defaultAssetParams,
	defaultPerpPosition,
	defaultRedbankSettings,
	StateMock,
} from '../mocks/stateMock'
import {
	OSMOSIS_AXL_USDC_DENOM,
	OSMOSIS_NOBLE_USDC_DENOM,
} from '../../../src/rover/constants/denoms'

describe('Liquidation Action Generator Tests', () => {
	let mock = StateMock.default()

	const mockRouteRequester: jest.Mocked<RouteRequester> = {
		getRoute: jest.fn(),
		apiUrl: 'http://localhost:8080',
	}

	const liquidationActionGenerator = new ActionGenerator(mockRouteRequester)

	describe('uusd collateral; atom debt', () => {
		let actions: Action[] = []
		beforeAll(async () => {
			mock = StateMock.default()
			mockRouteRequester.getRoute.mockReset()

			mock.setUserDeposits([
				{
					denom: 'uusd',
					amount: '1000',
				},
			])

			mock.setUserDebts([
				{
					denom: 'uatom',
					amount: '86',
				},
			])

			// We need to mock the route requester to return the correct routes
			// First swap call is to swap collateral to debt
			mockRouteRequester.getRoute.mockResolvedValueOnce({
				amountIn: '1000',
				estimatedAmountOut: '100',
				operations: [
					{
						chainId: 'osmosis-1',
						steps: [
							{
								venue: 'osmosis',
								denomIn: 'uusd',
								denomOut: 'uatom',
								pool: '1',
							},
						],
					},
				],
			})

			// next swap is to swap debt to stable
			mockRouteRequester.getRoute.mockResolvedValueOnce({
				amountIn: '100',
				estimatedAmountOut: '100',
				operations: [
					{
						chainId: 'osmosis-1',
						steps: [
							{
								venue: 'osmosis',
								denomIn: 'uatom',
								denomOut: 'uusd',
								pool: '1',
							},
						],
					},
				],
			})

			actions = await liquidationActionGenerator.generateLiquidationActions(
				'neutron',
				mock.account,
				mock.prices,
				mock.markets,
				mock.assetParams,
				mock.getHealth(),
				mock.neutralDenom,
			)
		})

		it('Action 0; Should borrow atom', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('20')
			expect(denom).toBe('uatom')
		})
		it('Action 1; Should select deposit usd collateral', () => {
			// @ts-ignore
			let denom: String = actions[1].liquidate.request.deposit

			expect(denom).toBe('uusd')
		})
		it('Action 1; Should select atom debt to repay', () => {
			//@ts-ignore
			let debtCoin: Coin = actions[1].liquidate.debt_coin

			expect(debtCoin.denom).toBe('uatom')
			// TODO check correct debt here
			expect(debtCoin.amount).toBe('20')
		})

		it('Action 2; Should swap all won usd collateral to atom', () => {
			//@ts-ignore
			let swapIn: Coin = actions[2].swap_exact_in.coin_in
			//@ts-ignore
			let denomOut: String = actions[2].swap_exact_in.denom_out

			// todo check min received here

			expect(swapIn.denom).toBe('uusd')
			expect(swapIn.amount).toBe('account_balance')
			expect(denomOut).toBe('uatom')
		})

		it('Action 3; Should repay atom', () => {
			// @ts-ignore
			let repayCoin: ActionCoin = actions[3].repay.coin
			//@ts-ignore
			let recipient_account_id: string | null = actions[3].repay.recipient_account_id

			expect(repayCoin.denom).toBe('uatom')
			expect(repayCoin.amount).toBe('account_balance')
			expect(recipient_account_id).toBe(undefined)
		})

		it('Action 4; Should refund balances', () => {
			const lastAction = actions[actions.length - 1]
			// @ts-ignore
			expect(lastAction.refund_all_coin_balances).toBeDefined()
		})
	})
	// Single collateral, multiple debts
	describe('uusd collateral; usd debt(smaller), atom debt(larger)', () => {
		let actions: Action[] = []
		beforeAll(async () => {
			mock = StateMock.default()
			mockRouteRequester.getRoute.mockReset()

			mock.setUserDeposits([
				{
					denom: 'uusd',
					amount: '750',
				},
			])

			mock.setUserDebts([
				{
					denom: 'uatom',
					amount: '60',
				},
				{
					denom: 'uusd',
					amount: '150',
				},
			])

			// We need to mock the route requester to return the correct routes
			// First swap call is to swap collateral to debt
			mockRouteRequester.getRoute.mockResolvedValueOnce({
				amountIn: '1000',
				estimatedAmountOut: '100',
				operations: [
					{
						chainId: 'osmosis-1',
						steps: [
							{
								venue: 'osmosis',
								denomIn: 'uusd',
								denomOut: 'uatom',
								pool: '1',
							},
						],
					},
				],
			})

			// next swap is to swap debt to stable
			mockRouteRequester.getRoute.mockResolvedValueOnce({
				amountIn: '100',
				estimatedAmountOut: '100',
				operations: [
					{
						chainId: 'osmosis-1',
						steps: [
							{
								venue: 'osmosis',
								denomIn: 'uatom',
								denomOut: 'uusd',
								pool: '1',
							},
						],
					},
				],
			})

			actions = await liquidationActionGenerator.generateLiquidationActions(
				'neutron',
				mock.account,
				mock.prices,
				mock.markets,
				mock.assetParams,
				mock.getHealth(),
				mock.neutralDenom,
			)
		})

		it('Action 0; Should borrow atom', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('14')
			expect(denom).toBe('uatom')
		})
		it('Action 1; Should select deposit usd collateral', () => {
			// @ts-ignore
			let denom: String = actions[1].liquidate.request.deposit

			expect(denom).toBe('uusd')
		})
		it('Action 1; Should select atom debt to repay', () => {
			//@ts-ignore
			let debtCoin: Coin = actions[1].liquidate.debt_coin

			expect(debtCoin.denom).toBe('uatom')
			expect(debtCoin.amount).toBe('14')
		})

		it('Action 2; Should swap all won usd collateral to atom', () => {
			//@ts-ignore
			let swapIn: Coin = actions[2].swap_exact_in.coin_in
			//@ts-ignore
			let denomOut: String = actions[2].swap_exact_in.denom_out

			// todo check min received here

			expect(swapIn.denom).toBe('uusd')
			expect(swapIn.amount).toBe('account_balance')
			expect(denomOut).toBe('uatom')
		})

		it('Action 3; Should repay atom', () => {
			// @ts-ignore
			let repayCoin: ActionCoin = actions[3].repay.coin
			//@ts-ignore
			let recipient_account_id: string | null = actions[3].repay.recipient_account_id

			expect(repayCoin.denom).toBe('uatom')
			expect(repayCoin.amount).toBe('account_balance')
			expect(recipient_account_id).toBe(undefined)
		})

		it('Action 4; Should refund balances', () => {
			const lastAction = actions[actions.length - 1]
			// @ts-ignore
			expect(lastAction.refund_all_coin_balances).toBeDefined()
		})
	})

	describe('uusd collateral; usd debt(larger), atom debt(smaller),', () => {
		let actions: Action[] = []
		beforeAll(async () => {
			mock = StateMock.default()
			mockRouteRequester.getRoute.mockReset()

			mock.setUserDeposits([
				{
					denom: 'uusd',
					amount: '1000',
				},
			])

			// Make usd larger debt
			mock.setUserDebts([
				{
					denom: 'uatom',
					amount: '40', // 40 * 10 = 400
				},
				{
					denom: 'uusd',
					amount: '500', // 500 * 1 = 500
				},
			])

			// We don't need to swap anything

			actions = await liquidationActionGenerator.generateLiquidationActions(
				'neutron',
				mock.account,
				mock.prices,
				mock.markets,
				mock.assetParams,
				mock.getHealth(),
				mock.neutralDenom,
			)
		})

		it('Should borrow usd', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('242')
			expect(denom).toBe('uusd')
		})
		it('Should pick the usd collateral', () => {
			// @ts-ignore
			let denom: String = actions[1].liquidate.request.deposit

			expect(denom).toBe('uusd')
		})
		it('Should pick the usd debt to repay', () => {
			// @ts-ignore
			let debtCoin: Coin = actions[1].liquidate.debt_coin

			expect(debtCoin.denom).toBe('uusd')
			// TODO check correct debt here
			expect(debtCoin.amount).toBe('242')
		})

		it('Should not do any swap of the collateral', () => {
			//@ts-ignore
			expect(actions.length).toBe(4)
			// @ts-ignore
			expect(actions[2].swap_exact_in).toBe(undefined)
		})

		it('Should repay usd', () => {
			// @ts-ignore
			let repayCoin: ActionCoin = actions[2].repay.coin
			//@ts-ignore
			let recipient_account_id: string | null = actions[2].repay.recipient_account_id

			expect(repayCoin.denom).toBe('uusd')
			expect(repayCoin.amount).toBe('account_balance')
			expect(recipient_account_id).toBe(undefined)
		})
	})

	describe('uusd collateral; perp negative pnl; no spot debt;', () => {
		let actions: Action[] = []
		beforeAll(async () => {
			mock = StateMock.default()
			mockRouteRequester.getRoute.mockReset()

			mock.setUserDeposits([
				{
					denom: 'uusd',
					amount: '1000',
				},
			])

			// Make usd larger debt
			mock.setUserDebts([])

			mock.setUserPerpsPositions([
				{
					...defaultPerpPosition,
					denom: 'ubtc',
					size: '100',
					base_denom: 'uusd',
					unrealized_pnl: {
						...defaultPerpPosition.unrealized_pnl,
						pnl: '-600',
						price_pnl: '-600',
					},
					entry_price: '100',
					current_price: '94',
					current_exec_price: '94',
				},
			])

			// We don't need to swap anything

			actions = await liquidationActionGenerator.generateLiquidationActions(
				'osmosis',
				mock.account,
				mock.prices,
				mock.markets,
				mock.assetParams,
				mock.getHealth(),
				mock.neutralDenom,
			)
		})

		it('Should borrow usd', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('291')
			expect(denom).toBe('uusd')
		})

		it('Should pick the usd collateral', () => {
			// @ts-ignore
			let denom: String = actions[1].liquidate.request.deposit

			expect(denom).toBe('uusd')
		})

		it('Should repay negative pnl', () => {
			// @ts-ignore
			let debtCoin: Coin = actions[1].liquidate.debt_coin

			expect(debtCoin.denom).toBe('uusd')
			expect(debtCoin.amount).toBe('291')
		})

		it('Should not do any swap of the collateral', () => {
			//@ts-ignore
			expect(actions.length).toBe(4)
			// @ts-ignore
			expect(actions[2].swap_exact_in).toBe(undefined)
		})

		it('Should repay usd', () => {
			// @ts-ignore
			let repayCoin: ActionCoin = actions[2].repay.coin
			//@ts-ignore
			let recipient_account_id: string | null = actions[2].repay.recipient_account_id

			expect(repayCoin.denom).toBe('uusd')
			expect(repayCoin.amount).toBe('account_balance')
			expect(recipient_account_id).toBe(undefined)
		})
	})

	describe('uusd collateral; perp negative pnl; spot debt (networth negative);', () => {
		let actions: Action[] = []
		beforeAll(async () => {
			mock = StateMock.default()
			mockRouteRequester.getRoute.mockReset()

			mock.setUserDeposits([
				{
					denom: 'uusd',
					amount: '1000',
				},
			])

			mock.setUserDebts([])

			mock.setUserPerpsPositions([
				{
					...defaultPerpPosition,
					denom: 'ubtc',
					size: '100',
					base_denom: 'uusd',
					unrealized_pnl: {
						...defaultPerpPosition.unrealized_pnl,
						pnl: '-1100',
						price_pnl: '-1100',
					},
					entry_price: '100',
					current_price: '89',
					current_exec_price: '89',
				},
			])

			// We don't need to swap anything

			actions = await liquidationActionGenerator.generateLiquidationActions(
				'osmosis',
				mock.account,
				mock.prices,
				mock.markets,
				mock.assetParams,
				mock.getHealth(),
				mock.neutralDenom,
			)
		})

		it('Should borrow usd', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('485')
			expect(denom).toBe('uusd')
		})

		it('Should pick the usd collateral', () => {
			// @ts-ignore
			let denom: String = actions[1].liquidate.request.deposit

			expect(denom).toBe('uusd')
		})

		it('Should repay all negative pnl', () => {
			// @ts-ignore
			let debtCoin: Coin = actions[1].liquidate.debt_coin

			expect(debtCoin.denom).toBe('uusd')
			expect(debtCoin.amount).toBe('485')
		})

		it('Should not do any swap of the collateral', () => {
			//@ts-ignore
			expect(actions.length).toBe(4)
			// @ts-ignore
			expect(actions[2].swap_exact_in).toBe(undefined)
		})

		it('Should repay usd', () => {
			// @ts-ignore
			let repayCoin: ActionCoin = actions[2].repay.coin
			//@ts-ignore
			let recipient_account_id: string | null = actions[2].repay.recipient_account_id

			expect(repayCoin.denom).toBe('uusd')
			expect(repayCoin.amount).toBe('account_balance')
			expect(recipient_account_id).toBe(undefined)
		})
	})

	describe('non borrowable debt asset uses configured substitute', () => {
		const borrowSubstitutes = {
			[OSMOSIS_AXL_USDC_DENOM]: {
				denom: OSMOSIS_NOBLE_USDC_DENOM,
				priceBuffer: 0.01,
			},
		}

		const substituteActionGenerator = new ActionGenerator(mockRouteRequester, borrowSubstitutes)
		let actions: Action[] = []

		beforeAll(async () => {
			const substituteState = StateMock.default()

			const axlAssetParams = {
				...defaultAssetParams,
				denom: OSMOSIS_AXL_USDC_DENOM,
				red_bank: { ...defaultRedbankSettings, borrow_enabled: false },
			}
			const nobleAssetParams = {
				...defaultAssetParams,
				denom: OSMOSIS_NOBLE_USDC_DENOM,
				red_bank: { ...defaultRedbankSettings, borrow_enabled: true },
			}

			substituteState.assetParams.set(OSMOSIS_AXL_USDC_DENOM, axlAssetParams)
			substituteState.assetParams.set(OSMOSIS_NOBLE_USDC_DENOM, nobleAssetParams)

			substituteState.prices.set(
				OSMOSIS_AXL_USDC_DENOM,
				substituteState.prices.get(substituteState.neutralDenom)!,
			)
			substituteState.prices.set(
				OSMOSIS_NOBLE_USDC_DENOM,
				substituteState.prices.get(substituteState.neutralDenom)!,
			)

			substituteState.setUserDeposits([
				{
					denom: substituteState.neutralDenom,
					amount: '1000',
				},
			])

			substituteState.setUserDebts([
				{
					denom: OSMOSIS_AXL_USDC_DENOM,
					amount: '600',
				},
			])

			mockRouteRequester.getRoute.mockReset()

		const substituteToDebtRoute = {
			amountIn: '600',
			estimatedAmountOut: '600',
				operations: [
					{
						chainId: 'osmosis-1',
						steps: [
							{
								venue: 'osmosis',
								denomIn: OSMOSIS_NOBLE_USDC_DENOM,
								denomOut: OSMOSIS_AXL_USDC_DENOM,
								pool: '1',
							},
						],
					},
				],
		}

		const debtToSubstituteRoute = {
			amountIn: '600',
			estimatedAmountOut: '600',
			operations: [
				{
					chainId: 'osmosis-1',
					steps: [
						{
							venue: 'osmosis',
							denomIn: OSMOSIS_AXL_USDC_DENOM,
							denomOut: OSMOSIS_NOBLE_USDC_DENOM,
							pool: '1',
						},
					],
				},
			],
		}

			const collateralToSubstituteRoute = {
				amountIn: '600',
				estimatedAmountOut: '600',
				operations: [
					{
						chainId: 'osmosis-1',
						steps: [
							{
								venue: 'osmosis',
								denomIn: substituteState.neutralDenom,
								denomOut: OSMOSIS_NOBLE_USDC_DENOM,
								pool: '1',
							},
						],
					},
				],
			}

			const substituteToNeutralRoute = {
				amountIn: '600',
				estimatedAmountOut: '600',
				operations: [
					{
						chainId: 'osmosis-1',
						steps: [
							{
								venue: 'osmosis',
								denomIn: OSMOSIS_NOBLE_USDC_DENOM,
								denomOut: substituteState.neutralDenom,
								pool: '1',
							},
						],
					},
				],
			}

			const health = substituteState.getHealth()
			// Force the position to be liquidatable
			health.liquidation_health_factor = '0.5'

		mockRouteRequester.getRoute
			.mockResolvedValueOnce(substituteToDebtRoute)
			.mockResolvedValueOnce(substituteToDebtRoute)
			.mockResolvedValueOnce(debtToSubstituteRoute)
			.mockResolvedValueOnce(collateralToSubstituteRoute)
			.mockResolvedValueOnce(substituteToNeutralRoute)

			actions = await substituteActionGenerator.generateLiquidationActions(
				'osmosis',
				substituteState.account,
				substituteState.prices,
				substituteState.markets,
				substituteState.assetParams,
				health,
				substituteState.neutralDenom,
			)
		})

		it('borrows the configured substitute asset first', () => {
			// @ts-ignore
			const borrowAction = actions[0].borrow

			expect(borrowAction.denom).toBe(OSMOSIS_NOBLE_USDC_DENOM)
			expect(new BigNumber(borrowAction.amount).isGreaterThan(0)).toBeTruthy()
		})

		it('swaps the borrowed substitute into the target debt asset', () => {
			// @ts-ignore
			const swapAction = actions[1].swap_exact_in

			expect(swapAction).toBeDefined()
			expect(swapAction.denom_out).toBe(OSMOSIS_AXL_USDC_DENOM)
		})

		it('liquidates using the non-borrowable debt denom', () => {
			// @ts-ignore
			const liquidationDebt = actions[2].liquidate.debt_coin

			expect(liquidationDebt.denom).toBe(OSMOSIS_AXL_USDC_DENOM)
		})

		it('swaps any excess target debt back into the borrowable asset', () => {
			// @ts-ignore
			const swapBackAction = actions[3].swap_exact_in

			expect(swapBackAction).toBeDefined()
			expect(swapBackAction.coin_in.denom).toBe(OSMOSIS_AXL_USDC_DENOM)
			expect(swapBackAction.denom_out).toBe(OSMOSIS_NOBLE_USDC_DENOM)
		})

		it('requests swap routes for substitute flow and repayments', () => {
			expect(mockRouteRequester.getRoute).toHaveBeenCalledTimes(4)
		})
	})
})

// TODO perp case When borrow amount is 0
