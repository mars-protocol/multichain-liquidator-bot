import BigNumber from 'bignumber.js'
import { Coin } from 'cosmology'
import { PriceResponse } from 'marsjs-types/creditmanager/generated/mars-mock-oracle/MarsMockOracle.types'
import {
	UncollateralizedLoanLimitResponse,
	UserDebtResponse,
} from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types'
import { MarketInfo } from '../rover/types/MarketInfo'
import { SwapperRoute } from '../types/swapper'

export interface AssetResponse {
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
	[key: string]: {
		debts: Debt[]
		collaterals: Collateral[]
	}
}

export interface DataResponse {
	data: UserPositionData
}

export interface VaultInfo {
	vaultAddress: string
	baseToken: string
	vaultToken: string
	totalSupply: string

	// This is how much lp token there is per share in a vault
	lpShareToVaultShareRatio: BigNumber
}

export interface RoverData {
	masterBalance: Coin[]
	markets: MarketInfo[]
	prices: PriceResponse[]
	whitelistedAssets: string[]
	creditLines: UserDebtResponse[]
	creditLineCaps: UncollateralizedLoanLimitResponse[]
	routes: SwapperRoute[]
	vaultInfo: Map<string, VaultInfo>
}

export interface CoreDataResponse {
	bank: {
		balance: Coin[]
	}
	wasm: {
		markets: MarketInfo[]
		prices: PriceResponse[]
		whitelistedAssets: string[]
		creditLines: UserDebtResponse[]
		creditLineCaps: UncollateralizedLoanLimitResponse[]
		routes: SwapperRoute[]
	}
}

export interface VaultInfoWasm {
	totalSupply: string
	info: {
		base_token: string
		vault_token: string
	}
	redeem: string
}

export interface VaultDataResponse {
	[key: string]: VaultInfoWasm
}
