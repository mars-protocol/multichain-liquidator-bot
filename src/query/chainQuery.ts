import { Positions } from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import { Market } from 'marsjs-types/mars-red-bank/MarsRedBank.types'
import { PriceResponse } from 'marsjs-types/mars-oracle-wasm/MarsOracleWasm.types'
import { Dictionary } from 'lodash'
import { TokensResponse } from 'marsjs-types/mars-account-nft/MarsAccountNft.types'
import { PriceSourceResponse } from '../types/oracle'
import { AssetParamsBaseForAddr, PerpParams } from 'marsjs-types/mars-params/MarsParams.types'
import { Balances, Collateral, Debt } from './types'
import fetch from 'cross-fetch'

// Handle all contract queries here, so they are easily mockable.
export class ChainQuery {
	constructor(
		private lcdUrl: string,
		private apiKey: string,
		private contracts: Dictionary<string>,
	) {}

	async queryContractSmart<T>(msg: Object, contractAddress: string): Promise<T> {

		const base64Msg = Buffer.from(JSON.stringify(msg)).toString('base64')
		const url = `${this.lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${base64Msg}?x-apikey=${this.apiKey}`
		const response = await fetch(url)
		return (await response.json())['data'] as T
	}

	public async queryMarket(denom: string): Promise<Market> {
		const msg = {
			market: {
				denom: denom,
			},
		}

		return this.queryContractSmart(msg, this.contracts.redbank)
	}

	public async queryMarkets(startAfter?: string, limit?: Number): Promise<Market[]> {
		const msg = {
			markets: {
				start_after: startAfter,
				limit: limit,
			},
		}

		return this.queryContractSmart(msg, this.contracts.redbank)
	}

	public async queryOraclePrice(denom: string): Promise<PriceResponse> {
		const msg = {
			price: {
				denom: denom,
			},
		}

		return this.queryContractSmart(msg, this.contracts.oracle)
	}

	public async queryOraclePrices(startAfter?: String, limit?: Number): Promise<PriceResponse[]> {
		const msg = {
			prices: {
				start_after: startAfter,
				limit: limit,
			},
		}

		return this.queryContractSmart(msg, this.contracts.oracle)
	}

	public async queryOraclePriceSources(
		startAfter?: String,
		limit?: Number,
	): Promise<PriceSourceResponse[]> {
		const msg = {
			price_sources: {
				start_after: startAfter,
				limit: limit,
			},
		}

		return this.queryContractSmart(msg, this.contracts.oracle)
	}

	public async queryPerpParams(startAfter?: String, limit?: Number): Promise<PerpParams[]> {
		const msg = {
			all_perp_params: {
				start_after: startAfter,
				limit: limit,
			},
		}

		return this.queryContractSmart(msg, this.contracts.params)
	}

	public async queryPositionsForAccount(accountId: String): Promise<Positions> {
		const msg = {
			positions: {
				account_id: accountId,
			},
		}

		let positions: Positions = await this.queryContractSmart(msg, this.contracts.creditManager)
		positions.staked_astro_lps = []
		positions.perps = []
		positions.account_kind = "default"
		return positions
	}

	public async queryAllAssetParams(
		startAfter?: String,
		limit?: Number,
	): Promise<AssetParamsBaseForAddr[]> {
		let msg = {
			all_asset_params: {
				start_after: startAfter,
				limit: limit,
			},
		}

		let params : AssetParamsBaseForAddr[] = await this.queryContractSmart(msg, this.contracts.params)
		params = params.map((param) => {
			param.close_factor = "0.5"
			param.red_bank.withdraw_enabled = true
			param.credit_manager.withdraw_enabled = true
			return param
		})

		return params
	}

	public async queryAccountsForAddress(liquidatorAddress: String): Promise<TokensResponse> {
		const msg = {
			tokens: { owner: liquidatorAddress },
		}
		return this.queryContractSmart(msg, this.contracts.accountNft)
	}

	public async queryRedbankCollaterals(address: string): Promise<Collateral[]> {
		const msg = { user_collaterals: { user: address } }
		return this.queryContractSmart(msg, this.contracts.redbank)
	}

	public async queryRedbankDebts(address: string): Promise<Debt[]> {
		const msg = { user_debts: { user: address } }
		return this.queryContractSmart(msg, this.contracts.redbank)
	}

	public async queryBalance(address: string): Promise<Balances> {
		const url = `${this.lcdUrl}/cosmos/bank/v1beta1/balances/${address}?x-apikey=${this.apiKey}`
		const response = await fetch(url)
		return (await response.json()) as Balances
	}
}
