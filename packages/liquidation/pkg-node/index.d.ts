/* tslint:disable */
/* eslint-disable */
/**
 * @param {LiquidationAmountInputs} inputs
 * @returns {LiquidationAmounts}
 */
export function calculate_liquidation_amounts_js(
	inputs: LiquidationAmountInputs,
): LiquidationAmounts
export interface LiquidationAmountInputs {
	collateral_amount: Uint128
	collateral_price: Decimal
	collateral_params: AssetParams
	debt_amount: Uint128
	debt_requested_to_repay: Uint128
	debt_price: Decimal
	debt_params: AssetParams
	health: HealthData
	perps_lb_ratio: Decimal
}

export interface LiquidationAmounts {
	debt_amount: Uint128
	collateral_amount: Uint128
	collateral_amount_received_by_liquidator: Uint128
}

export interface HealthData {
	liquidation_health_factor: Decimal
	collateralization_ratio: Decimal
	perps_pnl_loss: Uint128
	account_net_value: Int128
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
