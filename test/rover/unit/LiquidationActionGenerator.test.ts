import { Action, ActionCoin, Coin } from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import { RouteRequester } from '../../../src/query/routing/RouteRequesterInterface'
import { ActionGenerator } from '../../../src/rover/ActionGenerator'
import { defaultPerpPosition, StateMock } from '../mocks/stateMock'
import Long from 'long'
import { Pool } from '../../../src/types/Pool'

describe('Liquidation Action Generator Tests', () => {
	let mock = StateMock.default()

	const mockRouteRequester: jest.Mocked<RouteRequester> = {
		requestRoute: jest.fn(),
		apiUrl: 'http://localhost:8080',
	}

	const liquidationActionGenerator = new ActionGenerator(mockRouteRequester)

	describe('uusd collateral; atom debt', () => {
		let actions: Action[] = []
		beforeAll(async () => {
			mock.setUserDeposits([
				{
					denom: 'uusd',
					amount: '1000',
				},
			])

			mock.setUserDebts([
				{
					denom: 'uatom',
					amount: '80',
				},
			])

			// We need to mock the route requester to return the correct routes
			// First swap call is to swap collateral to debt
			mockRouteRequester.requestRoute.mockResolvedValueOnce({
				route: [
					{
						poolId: Long.fromNumber(1),
						tokenInDenom: 'uusd',
						tokenOutDenom: 'uatom',
						pool: {} as Pool,
					},
				],
				// todo
				expectedOutput: '100',
			})

			// next swap is to swap debt to stable
			mockRouteRequester.requestRoute.mockResolvedValueOnce({
				route: [
					{
						poolId: Long.fromNumber(1),
						tokenInDenom: 'uatom',
						tokenOutDenom: 'uusd',
						pool: {} as Pool,
					},
				],
				//todo
				expectedOutput: '100',
			})

			actions = await liquidationActionGenerator.generateLiquidationActions(
				mock.account,
				mock.prices,
				mock.markets,
				mock.neutralDenom,
			)
		})

		it('Action 0; Should borrow atom', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('80')
			expect(denom).toBe('uatom')
		})
		it('Action 1; Should select deposit usd collateral', () => {
			console.log(actions[1])
			// @ts-ignore
			let denom: String = actions[1].liquidate.request.deposit

			expect(denom).toBe('uusd')
		})
		it('Action 1; Should select atom debt to repay', () => {
			//@ts-ignore
			let debtCoin: Coin = actions[1].liquidate.debt_coin

			expect(debtCoin.denom).toBe('uatom')
			// TODO check correct debt here
			expect(debtCoin.amount).toBe('80')
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

		it('Action 4; Should swap atom to usd', () => {
			//@ts-ignore
			let swapIn: Coin = actions[4].swap_exact_in.coin_in
			//@ts-ignore
			let denomOut: String = actions[4].swap_exact_in.denom_out

			// todo check min received here

			expect(swapIn.denom).toBe('uatom')
			expect(swapIn.amount).toBe('account_balance')
			expect(denomOut).toBe('uusd')
		})
	})
	// Single collateral, multiple debts
	describe('uusd collateral; usd debt(smaller), atom debt(larger)', () => {
		let actions: Action[] = []
		beforeAll(async () => {
			mock.setUserDeposits([
				{
					denom: 'uusd',
					amount: '1000',
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
			mockRouteRequester.requestRoute.mockResolvedValueOnce({
				route: [
					{
						poolId: Long.fromNumber(1),
						tokenInDenom: 'uusd',
						tokenOutDenom: 'uatom',
						pool: {} as Pool,
					},
				],
				// todo
				expectedOutput: '100',
			})

			// next swap is to swap debt to stable
			mockRouteRequester.requestRoute.mockResolvedValueOnce({
				route: [
					{
						poolId: Long.fromNumber(1),
						tokenInDenom: 'uatom',
						tokenOutDenom: 'uusd',
						pool: {} as Pool,
					},
				],
				//todo
				expectedOutput: '100',
			})

			actions = await liquidationActionGenerator.generateLiquidationActions(
				mock.account,
				mock.prices,
				mock.markets,
				mock.neutralDenom,
			)
		})

		it('Action 0; Should borrow atom', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('60')
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
			expect(debtCoin.amount).toBe('60')
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

		it('Action 4; Should swap atom to usd', () => {
			//@ts-ignore
			let swapIn: Coin = actions[4].swap_exact_in.coin_in
			//@ts-ignore
			let denomOut: String = actions[4].swap_exact_in.denom_out

			// todo check min received here

			expect(swapIn.denom).toBe('uatom')
			expect(swapIn.amount).toBe('account_balance')
			expect(denomOut).toBe('uusd')
		})
	})

	describe('uusd collateral; usd debt(larger), atom debt(smaller),', () => {
		let actions: Action[] = []
		beforeAll(async () => {
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
					amount: '450', // 450 * 1 = 450
				},
			])

			// We don't need to swap anything

			actions = await liquidationActionGenerator.generateLiquidationActions(
				mock.account,
				mock.prices,
				mock.markets,
				mock.neutralDenom,
			)
		})

		it('Should borrow usd', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('450')
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
			expect(debtCoin.amount).toBe('450')
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
					base_denom: 'uusd',
					unrealized_pnl: {
						...defaultPerpPosition.unrealized_pnl,
						pnl: '-100',
					},
				},
			])

			// We don't need to swap anything

			actions = await liquidationActionGenerator.generateLiquidationActions(
				mock.account,
				mock.prices,
				mock.markets,
				mock.neutralDenom,
			)
		})

		it('Should borrow usd', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('100')
			expect(denom).toBe('uusd')
		})

		it('Should pick the usd collateral', () => {
			console.log(actions[1])
			// @ts-ignore
			let denom: String = actions[1].liquidate.request.deposit

			expect(denom).toBe('uusd')
		})

		it('Should repay all negative pnl', () => {
			// @ts-ignore
			let debtCoin: Coin = actions[1].liquidate.debt_coin

			expect(debtCoin.denom).toBe('uusd')
			expect(debtCoin.amount).toBe('100')
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
					base_denom: 'uusd',
					unrealized_pnl: {
						...defaultPerpPosition.unrealized_pnl,
						pnl: '-1100',
					},
				},
			])

			// We don't need to swap anything

			actions = await liquidationActionGenerator.generateLiquidationActions(
				mock.account,
				mock.prices,
				mock.markets,
				mock.neutralDenom,
			)
		})

		it('Should borrow usd', () => {
			// @ts-ignore
			let amount: String = actions[0].borrow.amount
			// @ts-ignore
			let denom: String = actions[0].borrow.denom

			expect(amount).toBe('1100')
			expect(denom).toBe('uusd')
		})

		it('Should pick the usd collateral', () => {
			console.log(actions[1])
			// @ts-ignore
			let denom: String = actions[1].liquidate.request.deposit

			expect(denom).toBe('uusd')
		})

		it('Should repay all negative pnl', () => {
			// @ts-ignore
			let debtCoin: Coin = actions[1].liquidate.debt_coin

			expect(debtCoin.denom).toBe('uusd')
			expect(debtCoin.amount).toBe('1100')
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
})
