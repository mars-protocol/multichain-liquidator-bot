/* tslint:disable */
/* eslint-disable */
/**
 * @param {HealthComputer} c
 * @returns {HealthValuesResponse}
 */
export function compute_health_js(c: HealthComputer): HealthValuesResponse
/**
 * @param {HealthComputer} c
 * @param {string} withdraw_denom
 * @returns {string}
 */
export function max_withdraw_estimate_js(c: HealthComputer, withdraw_denom: string): string
/**
 * @param {HealthComputer} c
 * @param {string} borrow_denom
 * @param {BorrowTarget} target
 * @returns {string}
 */
export function max_borrow_estimate_js(
	c: HealthComputer,
	borrow_denom: string,
	target: BorrowTarget,
): string
/**
 * @param {HealthComputer} c
 * @param {string} from_denom
 * @param {string} to_denom
 * @param {SwapKind} kind
 * @param {Number} slippage
 * @param {boolean} is_repaying_debt
 * @returns {string}
 */
export function max_swap_estimate_js(
	c: HealthComputer,
	from_denom: string,
	to_denom: string,
	kind: SwapKind,
	slippage: Number,
	is_repaying_debt: boolean,
): string
/**
 * @param {HealthComputer} c
 * @param {string} denom
 * @param {LiquidationPriceKind} kind
 * @returns {string}
 */
export function liquidation_price_js(
	c: HealthComputer,
	denom: string,
	kind: LiquidationPriceKind,
): string
/**
 * @param {HealthComputer} c
 * @param {string} denom
 * @param {string} base_denom
 * @param {Uint} long_oi_amount
 * @param {Uint} short_oi_amount
 * @param {Direction} direction
 * @returns {string}
 */
export function max_perp_size_estimate_js(
	c: HealthComputer,
	denom: string,
	base_denom: string,
	long_oi_amount: Uint,
	short_oi_amount: Uint,
	direction: Direction,
): string
export type Direction = 'long' | 'short'

export interface HealthComputer {
	kind: AccountKind
	positions: Positions
	asset_params: Record<string, AssetParams>
	vaults_data: VaultsData
	perps_data: PerpsData
	oracle_prices: Record<string, Decimal>
}

export interface HealthValuesResponse {
	total_debt_value: Uint128
	total_collateral_value: Uint128
	max_ltv_adjusted_collateral: Uint128
	liquidation_threshold_adjusted_collateral: Uint128
	max_ltv_health_factor: Decimal | null
	liquidation_health_factor: Decimal | null
	perps_pnl_profit: Uint128
	perps_pnl_loss: Uint128
	liquidatable: boolean
	above_max_ltv: boolean
	has_perps: boolean
}

export type LiquidationPriceKind = 'asset' | 'debt' | 'perp'

export type Uint = Uint128

export type Number = Decimal

export type SwapKind = 'default' | 'margin'

export type BorrowTarget =
	| 'deposit'
	| 'wallet'
	| { vault: { address: Addr } }
	| { swap: { denom_out: string; slippage: Decimal } }
