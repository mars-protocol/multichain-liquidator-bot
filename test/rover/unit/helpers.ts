import {
	UserDebtResponse,
} from 'marsjs-types/mars-red-bank/MarsRedBank.types'
import { MarketInfo } from '../../../src/rover/types/MarketInfo'
import { PerpPosition } from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import BigNumber from 'bignumber.js'

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
		available_liquidity: new BigNumber(Math.random() * 100000),
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

export const generateBlankPerpPositionWithPnl = (
	baseDenom: string,
	perpDenom: string,
	pnl: string
): PerpPosition => {

	const unrealizedPnl = {
		accrued_funding: '0',
		closing_fee: '0',
		opening_fee: '0',
		pnl: pnl,
		price_pnl: '0',
	}

	const realizedPnl = {
		accrued_funding: '0',
		closing_fee: '0',
		opening_fee: '0',
		pnl: '0',
		price_pnl: '0',
	}

	const perpPosition = {
		denom: perpDenom,
		base_denom: baseDenom,
		current_exec_price: '0',
		current_price: '0',
		entry_exec_price: '0',
		entry_price: '0',
		realized_pnl: realizedPnl,
		size: '0',
		unrealized_pnl: unrealizedPnl,
	}

	return perpPosition
}