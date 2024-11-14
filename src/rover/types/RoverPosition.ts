import BigNumber from 'bignumber.js'
export interface RoverPosition {
	collaterals: Collateral[]
	debts: Debt[]
	accountId: string
}

export enum PositionType {
	LEND,
	DEPOSIT,
	VAULT,
	STAKED_ASTRO_LP,
}

export interface Collateral {
	type: PositionType
	value: BigNumber
	amount: BigNumber
	denom: string
}

export interface Debt {
	amount: BigNumber
	denom: string
	value: BigNumber
}
