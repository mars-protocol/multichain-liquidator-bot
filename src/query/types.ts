import { Coin } from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'

export interface AssetResponse extends Coin {
	denom: string
	amount_scaled: string
	amount: string
}

export interface Debt extends AssetResponse {
	uncollateralised: boolean
}
export interface Collateral extends AssetResponse {
	enabled: boolean
}

export interface UserPositionData {
	address: string
	debts: Debt[]
	collaterals: Collateral[]
}

export interface Balances {
	balances: Coin[]
}
