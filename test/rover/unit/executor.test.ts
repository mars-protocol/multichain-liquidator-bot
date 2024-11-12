import {
	Coin,
	Positions,
} from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import { RoverExecutor } from '../../../src/rover/RoverExecutor'
import { calculatePositionStateAfterPerpClosure } from '../../../src/helpers'
import { generateBlankPerpPositionWithPnl } from './helpers'

describe('Rover Executor Tests', () => {
	describe('Update Position State For Perp Closure', () => {

		test('Has no debt, no usdc deposit, positive pnl', () => {
			const baseDenom = 'uusd'
			const perpPositionETH = generateBlankPerpPositionWithPnl(baseDenom, 'eth', '100')

			const positions: Positions = {
				account_id: '1',
				account_kind: 'default',
				debts: [
					{
						amount: '0',
						denom:  baseDenom,
						shares: '0',
					},
				],
				deposits: [],
				lends: [],
				staked_astro_lps: [],
				vaults: [],
				perps: [
					perpPositionETH,
				],
			}

			// calculate the debts, deposits
			const details = calculatePositionStateAfterPerpClosure(positions, baseDenom);

			expect(details.debts[0].amount).toBe('0')
			expect(details.debts[0].denom).toBe('uusd')
			expect(details.deposits[0].amount).toBe('100')
			expect(details.deposits[0].denom).toBe('uusd')
		}),

		test('Has no debt, no usdc deposit, negative pnl', () => {
			const baseDenom = 'uusd'
			const perpPositionETH = generateBlankPerpPositionWithPnl(baseDenom, 'eth', '-100')

			const positions: Positions = {
				account_id: '1',
				account_kind: 'default',
				debts: [
					{
						amount: '0',
						denom:  baseDenom,
						shares: '0',
					},
				],
				deposits: [],
				lends: [],
				staked_astro_lps: [],
				vaults: [],
				perps: [
					perpPositionETH,
				],
			}

			// calculate the debts, deposits
			const details = calculatePositionStateAfterPerpClosure(positions, baseDenom);

			expect(details.debts[0].amount).toBe('100')
			expect(details.debts[0].denom).toBe('uusd')
		}),

		test('Has debt, Single negative pnl, network negative', () => {
			const baseDenom = 'uusd'
			
			const btcPerpPosition = generateBlankPerpPositionWithPnl(baseDenom, 'btc', '-200')

			const positions: Positions = {
				account_id: '1',
				account_kind: 'default',
				debts: [
					{
						amount: '1000',
						denom:  baseDenom,
						shares: '1000',
					},
				],
				deposits: [],
				lends: [],
				staked_astro_lps: [],
				vaults: [],
				perps: [btcPerpPosition],
			}

			// calculate the debts, deposits
			const details = calculatePositionStateAfterPerpClosure(positions, baseDenom);
			expect(details.debts[0].amount).toBe('1200')
			expect(details.debts[0].denom).toBe('uusd')
		}),
		test('Has debt, One negative pnl, One positive pnl, pnl net negative, networth negative', () => {
			const baseDenom = 'uusd'
			const perpPositionBTC = generateBlankPerpPositionWithPnl(baseDenom, 'btc', '-200')
			const perpPositionETH = generateBlankPerpPositionWithPnl(baseDenom, 'eth', '100')

			const positions: Positions = {
				account_id: '1',
				account_kind: 'default',
				debts: [
					{
						amount: '1000',
						denom:  baseDenom,
						shares: '1000',
					},
				],
				deposits: [],
				lends: [],
				staked_astro_lps: [],
				vaults: [],
				perps: [perpPositionBTC, perpPositionETH],
			}

			// calculate the debts, deposits
			const details = calculatePositionStateAfterPerpClosure(positions, baseDenom);
			expect(details.debts[0].amount).toBe('1100')
			expect(details.debts[0].denom).toBe('uusd')
		})

		test('Has debt, One negative pnl, two positive pnl, pnl net positive', () => {
			const baseDenom = 'uusd'
			const perpPositionBTC = generateBlankPerpPositionWithPnl(baseDenom, 'btc', '-200')
			const perpPositionETH = generateBlankPerpPositionWithPnl(baseDenom, 'eth', '100')
			const perpPositionDOGE = generateBlankPerpPositionWithPnl(baseDenom, 'doge', '200')

			const positions: Positions = {
				account_id: '1',
				account_kind: 'default',
				debts: [
					{
						amount: '1000',
						denom:  baseDenom,
						shares: '0',
					},
				],
				deposits: [],
				lends: [],
				staked_astro_lps: [],
				vaults: [],
				perps: [
					perpPositionBTC,
					perpPositionETH,
					perpPositionDOGE
				],
			}

			// calculate the debts, deposits
			const details = calculatePositionStateAfterPerpClosure(positions, baseDenom);
			expect(details.debts[0].amount).toBe('1000')
			expect(details.debts[0].denom).toBe('uusd')
		})

		test('Has debt, One negative pnl, two positive pnl, pnl net positive, networth positive', () => {
			const baseDenom = 'uusd'
			const perpPositionBTC = generateBlankPerpPositionWithPnl(baseDenom, 'btc', '-200')
			const perpPositionETH = generateBlankPerpPositionWithPnl(baseDenom, 'eth', '100')
			const perpPositionDOGE = generateBlankPerpPositionWithPnl(baseDenom, 'doge', '2000')

			const positions: Positions = {
				account_id: '1',
				account_kind: 'default',
				debts: [
					{
						amount: '1000',
						denom:  baseDenom,
						shares: '0',
					},
				],
				deposits: [],
				lends: [],
				staked_astro_lps: [],
				vaults: [],
				perps: [
					perpPositionBTC,
					perpPositionETH,
					perpPositionDOGE
				],
			}

			// calculate the debts, deposits
			const details = calculatePositionStateAfterPerpClosure(positions, baseDenom);

			expect(details.debts[0].amount).toBe('1000')
			expect(details.debts[0].denom).toBe('uusd')
			expect(details.deposits[0].amount).toBe('1900')
			expect(details.deposits[0].denom).toBe('uusd')
		}),

		test('No debt, some lends, some deposits, some negative pnl', () => {
			const baseDenom = 'uusd'
			const perpPositionBTC = generateBlankPerpPositionWithPnl(baseDenom, 'btc', '-200')

			const positions: Positions = {
				account_id: '1',
				account_kind: 'default',
				debts: [],
				deposits: [{
					amount: '100',
					denom:  baseDenom,
				}],
				lends: [{
					amount: '1000',
					denom:  baseDenom,
				}],
				staked_astro_lps: [],
				vaults: [],
				perps: [
					perpPositionBTC,
				],
			}

			const details = calculatePositionStateAfterPerpClosure(positions, baseDenom);

			// We first deduct from deposits, then unlend, then borrow
			// Because we have 1k lend and 1 deposit with 200 negative pnl, we should have 
			// 900 lend and 0 deposit 
			expect(details.debts[0].amount).toBe('0')
			expect(details.debts[0].denom).toBe('uusd')
			expect(details.deposits[0].amount).toBe('0')
			expect(details.deposits[0].denom).toBe('uusd')
			expect(details.lends[0].amount).toBe('900')
			expect(details.lends[0].denom).toBe('uusd')
		}),

		test('Negative pnl > deposits and lends', () => {
			const baseDenom = 'uusd'
			const perpPositionBTC = generateBlankPerpPositionWithPnl(baseDenom, 'btc', '-1200')

			const positions: Positions = {
				account_id: '1',
				account_kind: 'default',
				debts: [],
				deposits: [{
					amount: '100',
					denom:  baseDenom,
				}],
				lends: [{
					amount: '1000',
					denom:  baseDenom,
				}],
				staked_astro_lps: [],
				vaults: [],
				perps: [
					perpPositionBTC,
				],
			}

			const details = calculatePositionStateAfterPerpClosure(positions, baseDenom);

			// We first deduct from deposits, then unlend, then borrow
			// Because we have 1k lend and 100 deposit with -1200 negative pnl, we should have 
			// 0 lend and 0 deposit and 100 debt 
			expect(details.debts[0].amount).toBe('100')
			expect(details.debts[0].denom).toBe('uusd')
			expect(details.deposits[0].amount).toBe('0')
			expect(details.deposits[0].denom).toBe('uusd')
			expect(details.lends[0].amount).toBe('0')
			expect(details.lends[0].denom).toBe('uusd')
		})
	}),

	describe('Find Best Collateral', () => {

		test('Can find largest collateral when it is a coin', () => {
			// construct multiple collaterals - coins and vaults
			const collateral1: Coin = {
				amount: '1500',
				denom: 'testcoin1',
			}

			//@ts-ignore - parameters not used for testing - todo move to helper / logic class
			const executor = new RoverExecutor({}, {}, {})
			const collateralState = executor.findBestCollateral({
				account_id: "1",
				account_kind: "default",
				debts: [],
				deposits: [collateral1],
				lends: [],
				staked_astro_lps: [],
				vaults: [],
				perps: []
			})

			expect(collateralState.amount).toBe(1500)
			// find
			// ensure its the correct one
		})
	}),
	test('Can find largest debt', () => {
		// construct multiple collaterals - coins and vaults
		const debt1: Coin = {
			amount: '1500',
			denom: 'testcoin1',
		}

		const debt2: Coin = {
			amount: '1500',
			denom: 'testcoin1',
		}

		//@ts-ignore - parameters not used for testing
		const executor = new RoverExecutor({}, {}, {})
		const bestDebt = executor.findBestDebt([debt1, debt2])

		expect(bestDebt.amount).toBe(1500)
	})
})