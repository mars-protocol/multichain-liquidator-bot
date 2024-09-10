import BigNumber from 'bignumber.js'
import { VaultPositionType } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'

export interface RoverPosition {
	collaterals: Collateral[]
	debts: Debt[]
	accountId: string
}

export enum PositionType {
	LEND,
	DEPOSIT,
	VAULT,
	STAKED_ASTRO_LP
}

export interface Collateral {
	type: PositionType
	value: number
	amount: number
	denom: string
	price: number
	closeFactor: number
	vaultType?: VaultPositionType
	underlyingDenom?: string
}

export interface Debt {
	amount: number
	denom: string
	price: BigNumber
}
