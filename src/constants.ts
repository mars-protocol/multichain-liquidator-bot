export enum QueryType {
	DEBTS,
	COLLATERALS,
}

export const DEBTS = 'debts'
export const COLLATERALS = 'collaterals'

// This is the amount we send to the 'preview_redeem' method to calculate the
// underlying lp shares per vault share
export const REDEEM_BASE = (1e16).toString()

// Buffer is used as a margin of error
export const GENERIC_BUFFER = 0.99

export const DEFAULT_SWAP_SLIPPAGE_LIMIT = '0.005'