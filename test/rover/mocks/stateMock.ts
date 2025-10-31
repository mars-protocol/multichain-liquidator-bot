import {
	Addr,
	Coin,
	PerpPosition,
	Positions,
	VaultPositionValue,
} from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import { MarketInfo } from '../../../src/rover/types/MarketInfo'
import BigNumber from 'bignumber.js'
import { InterestRateModel } from 'marsjs-types/mars-red-bank/MarsRedBank.types'
import {
	AssetParamsBaseForAddr,
	CmSettingsForAddr,
	LiquidationBonus,
	PerpParams,
	RedBankSettings,
} from 'marsjs-types/mars-params/MarsParams.types'
import { HealthData, HealthValuesResponse } from 'mars-liquidation'
import { compute_health_js, HealthComputer } from 'mars-rover-health-computer-node'
import { logger } from '../../../src/logger'

export class StateMock {
	constructor(
		public neutralDenom: string,
		public account: Positions,
		public markets: Map<string, MarketInfo>,
		public assetParams: Map<string, AssetParamsBaseForAddr>,
		public prices: Map<string, BigNumber>,
	) {}

	public setUserDeposits(deposits: Coin[]): void {
		this.account.deposits = deposits
	}

	public setUserDebts(debts: Coin[]): void {
		this.account.debts = debts.map((debt) => {
			let object = { ...debt, shares: debt.amount }
			logger.info(JSON.stringify(object))
			return object
		})
	}

	public setUserPerpsPositions = (perps: PerpPosition[]): void => {
		this.account.perps = perps
	}

	public getHealth(): HealthData {
		let hc: HealthComputer = {
			kind: this.account.account_kind,
			positions: this.account,
			asset_params: Object.fromEntries(this.assetParams),
			oracle_prices: Object.fromEntries(this.prices),
			perps_data: defaultPerpsData,
			vaults_data: defaultVaultsData,
		}

		let healthResponse: HealthValuesResponse = compute_health_js(hc)

		const accountNetValue = new BigNumber(healthResponse.total_collateral_value)
			.minus(healthResponse.total_debt_value)
			.toFixed(0)
		const collateralizationRatio =
			healthResponse.total_debt_value === '0'
				? new BigNumber(100000000) // Instead of `infinity` we use a very high number
				: new BigNumber(healthResponse.total_collateral_value)
						.dividedBy(new BigNumber(healthResponse.total_debt_value))
						.toFixed(0)

		return {
			liquidation_health_factor: healthResponse.liquidation_health_factor,
			account_net_value: accountNetValue,
			collateralization_ratio: collateralizationRatio,
			perps_pnl_loss: healthResponse.perps_pnl_loss,
		}
	}

	public static default(): StateMock {
		return new StateMock(
			'uusd',
			{
				account_id: '1',
				account_kind: 'default',
				debts: [],
				deposits: [],
				lends: [],
				staked_astro_lps: [],
				vaults: [],
				perps: [],
			},
			new Map<string, MarketInfo>([
				['uusd', { ...defaultMarket, denom: 'uusd' }],
				['uatom', { ...defaultMarket, denom: 'uatom' }],
			]),
			new Map<string, AssetParamsBaseForAddr>([
				['uusd', { ...defaultAssetParams, denom: 'uusd' }],
				['uatom', { ...defaultAssetParams, denom: 'uatom' }],
			]),
			new Map<string, BigNumber>([
				['uusd', new BigNumber(1)],
				['uatom', new BigNumber(10)],
				['ubtc', new BigNumber(100)],
			]),
		)
	}
}

export const defaultVaultsData = {
	vault_values: new Map<Addr, VaultPositionValue>(),
	vault_configs: new Map<Addr, any>(),
}

export const defaultPerpParams: PerpParams = {
	denom: 'ubtc',
	enabled: true,
	liquidation_threshold: '0.85',
	max_funding_velocity: '0.1',
	max_loan_to_value: '0.8',
	max_long_oi_value: '100000000000',
	max_net_oi_value: '100000000000',
	max_position_value: '100000000000',
	max_short_oi_value: '100000000000',
	min_position_value: '100000000000',
	opening_fee_rate: '0.01',
	skew_scale: '100000000000',
	closing_fee_rate: '0.01',
}

export const defaultPerpsData = {
	params: Object.fromEntries(new Map<string, PerpParams>([['ubtc', defaultPerpParams]])),
}

export const defaultCmSettingsForAddr: CmSettingsForAddr = {
	whitelisted: true,
	hls: undefined,
	withdraw_enabled: true,
}

export const defaultLiquidationBonus: LiquidationBonus = {
	min_lb: '0.1',
	starting_lb: '0',
	max_lb: '0.3',
	slope: '0.1',
}

export const defaultRedbankSettings: RedBankSettings = {
	borrow_enabled: true,
	deposit_enabled: true,
	withdraw_enabled: true,
}

export const defaultAssetParams: AssetParamsBaseForAddr = {
	close_factor: '0.5',
	credit_manager: defaultCmSettingsForAddr,
	denom: 'uatom',
	deposit_cap: '100000000000',
	interest_rate_model: {
		base: '0',
		optimal_utilization_rate: '0.85',
		slope_1: '0.1',
		slope_2: '1.2',
	},
	reserve_factor: '0.1',
	liquidation_bonus: defaultLiquidationBonus,
	liquidation_threshold: '0.85',
	max_loan_to_value: '0.8',
	protocol_liquidation_fee: '0.25',
	red_bank: defaultRedbankSettings,
}

export const defaultPerpPosition: PerpPosition = {
	denom: 'uatom',
	base_denom: 'uusd',
	unrealized_pnl: {
		accrued_funding: '0',
		closing_fee: '0',
		opening_fee: '0',
		pnl: '0',
		price_pnl: '0',
	},
	realized_pnl: {
		accrued_funding: '0',
		closing_fee: '0',
		opening_fee: '0',
		pnl: '0',
		price_pnl: '0',
	},
	current_exec_price: '100',
	current_price: '100',
	entry_exec_price: '100',
	entry_price: '100',
	size: '10',
}

const defaultMarket: MarketInfo = {
	available_liquidity: new BigNumber(0),
	borrow_index: '0',
	borrow_rate: '0',
	collateral_total_scaled: '0',
	debt_total_scaled: '0',
	denom: 'uusd',
	indexes_last_updated: 0,
	interest_rate_model: {} as InterestRateModel,
	liquidity_index: '0',
	liquidity_rate: '0',
	reserve_factor: '0',
}
