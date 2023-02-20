import {
	UncollateralizedLoanLimitResponse,
	UserDebtResponse,
} from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types'
import { MarketInfo } from '../../../src/rover/types/MarketInfo'

export const generateRandomMarket = (denom?: string): MarketInfo => {
	return {
		denom: denom ? denom : Math.random().toString(),
		borrow_enabled: Math.random() > 0.5,
		deposit_enabled: Math.random() > 0.5,
		borrow_index: Math.random().toString(),
		borrow_rate: Math.random().toString(),
		collateral_total_scaled: Math.random().toString(),
		debt_total_scaled: Math.random().toString(),
		deposit_cap: Math.random().toString(),
		indexes_last_updated: Math.random(),
		//@ts-ignore we don't care about interest rate model for tests
		interest_rate_model: {},
		liquidation_bonus: Math.random().toString(),
		liquidation_threshold: Math.random().toString(),
		liquidity_index: Math.random().toString(),
		liquidity_rate: Math.random().toString(),
		max_loan_to_value: Math.random().toString(),
		available_liquidity: Math.random() * 100000,
	}
}

export const generateRandomCreditLine = (
	denom: string = 'atom',
	amount: string = '1000000000',
): UserDebtResponse => {
	return {
		amount,
		amount_scaled: 'not used',
		denom,
		uncollateralized: true,
	}
}

export const generateRandomCreditLineCap = (
	denom: string = 'uatom',
	limit: string = '1000000000',
): UncollateralizedLoanLimitResponse => {
	return {
		denom,
		limit,
	}
}
