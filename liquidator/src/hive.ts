import { Position } from './types/position'
import fetch from 'cross-fetch'
import { Positions } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import { Coin } from '@cosmjs/amino'
import { MarketInfo } from './rover/types/marketInfo'
import { PriceResponse } from 'marsjs-types/creditmanager/generated/mars-mock-oracle/MarsMockOracle.types'

import { NO_ROVER_DATA } from './rover/constants/errors'
import {
	UncollateralizedLoanLimitResponse,
	UserDebtResponse,
} from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types'
import BigNumber from 'bignumber.js'
import { SwapperRoute } from './types/swapper'

enum QueryType {
	DEBTS,
	COLLATERALS,
}

const DEBTS = 'debts'
const COLLATERALS = 'collaterals'

// This is the amount we send to the 'preview_redeem' method to calculate the
// underlying lp shares per vault share
const REDEEM_BASE = (1e16).toString()

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

interface CoreDataResponse {
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

interface VaultInfoWasm {
	totalSupply: string
	info: {
		base_token: string
		vault_token: string
	}
	redeem: string
}

interface VaultDataResponse {
	[key: string]: VaultInfoWasm
}

const getTypeString = (queryType: QueryType): string => {
	return queryType == QueryType.COLLATERALS ? COLLATERALS : DEBTS
}

const produceVaultTotalSupplySection = (vaultAddress: string): string => {
	return `
  totalSupply:contractQuery(
      contractAddress: "${vaultAddress}"
      query: { total_vault_token_supply : { } }
  )
`
}

const produceVaultInfoSection = (vaultAddress: string): string => {
	return `
  info:contractQuery(
      contractAddress: "${vaultAddress}"
      query: { info : { } }
  ),
`
}

const produceVaultRedeemSection = (vaultAddress: string, redeemBase: string): string => {
	return ` 
  redeem:contractQuery(
    contractAddress: "${vaultAddress}"
    query: {  preview_redeem: {amount:"${redeemBase}"} }
)`
}

const produceVaultQuery = (vaultAddress: string): string => {
	return `{
        ${vaultAddress}:wasm {
          ${produceVaultTotalSupplySection(vaultAddress)},
          ${produceVaultInfoSection(vaultAddress)},
          ${produceVaultRedeemSection(vaultAddress, REDEEM_BASE)}
        }
    }`
}

const produceUserPositionQuery = (user: string, redbankAddress: string): string => {
	return `{
        ${user}:wasm {
        ${producePositionQuerySection(user, QueryType.DEBTS, redbankAddress)},
        ${producePositionQuerySection(user, QueryType.COLLATERALS, redbankAddress)}
        }
    }`
}

const produceRoverAccountPositionQuery = (account_id: string, cmAddress: string): string => {
	return `{
          wasm {
            position: contractQuery(
              contractAddress: "${cmAddress}"
              query: { positions: { account_id: "${account_id}" } }
          )
          }
        }
      
    `
}

const producePositionQuerySection = (
	user: string,
	queryType: QueryType,
	redbankAddress: string,
) => {
	const typeString = getTypeString(queryType)
	return `
        ${typeString}:contractQuery(
            contractAddress: "${redbankAddress}"
            query: { user_${typeString}: { user: "${user}" } }
        )
    `
}

const produceVaultInfo = (vaultResponseData: VaultDataResponse): VaultInfo => {
	// get the keys - note that our keys will either be the vault address (for the bank module) or 'wasm' for the wasm module
	const vaultAddress = Object.keys(vaultResponseData)[0]

	const wasm: VaultInfoWasm = vaultResponseData[vaultAddress] as VaultInfoWasm
	const totalSupply = wasm.totalSupply
	const baseToken = wasm.info.base_token
	const vaultToken = wasm.info.vault_token
	const lpShareToVaultShareRatio = new BigNumber(wasm.redeem).dividedBy(REDEEM_BASE)

	return { vaultAddress, baseToken, totalSupply, vaultToken, lpShareToVaultShareRatio }
}

const produceCoreRoverDataQuery = (
	address: string,
	redbankAddress: string,
	oracleAddress: string,
	creditManagerAddress: string,
	swapperAddress: string,
) => {
	return `{
    bank {
      balance(address:"${address}") {
        denom,
        amount
      },
    }
    wasm {
        markets: contractQuery(
            contractAddress: "${redbankAddress}"
            query: { markets: {} }
        ),
        prices: contractQuery(
            contractAddress: "${oracleAddress}"
            query: { prices: {} }
        ),
        creditLines: contractQuery(
          contractAddress: "${redbankAddress}"
          query: { user_debts: { user :"${creditManagerAddress}"} }
        ),
        whitelistedAssets: contractQuery(
          contractAddress: "${creditManagerAddress}"
          query: { allowed_coins: {} }
        ),
        creditLineCaps: contractQuery(
          contractAddress: "${redbankAddress}"
          query: { uncollateralized_loan_limits: { user :"${creditManagerAddress}"} }
        ),
        routes: contractQuery(
          contractAddress: "${swapperAddress}"
          query: { routes: {} }
        ),
      }
    }`
}

export const fetchRoverData = async (
	hiveEndpoint: string,
	address: string,
	redbankAddress: string,
	oracleAddress: string,
	creditManagerAddress: string,
	swapperAddress: string,
	vaultAddresses: string[],
): Promise<RoverData> => {
	const coreQuery = produceCoreRoverDataQuery(
		address,
		redbankAddress,
		oracleAddress,
		creditManagerAddress,
		swapperAddress,
	)

	const queries = vaultAddresses.map((vault) => {
		return {
			query: produceVaultQuery(vault),
		}
	})

	queries.push({ query: coreQuery })

	const response = await fetch(hiveEndpoint, {
		method: 'post',
		body: JSON.stringify(queries),
		headers: { 'Content-Type': 'application/json' },
	})

	const result: { data: CoreDataResponse | VaultDataResponse }[] = await response.json()

	if (result.length === 0) {
		throw new Error(NO_ROVER_DATA)
	}
	const coreData: CoreDataResponse = result.pop()!.data as CoreDataResponse

	const vaultMap = new Map<string, VaultInfo>()

	result.forEach((vaultResponse) => {
		const vaultInfo: VaultInfo = produceVaultInfo(vaultResponse.data as VaultDataResponse)
		vaultMap.set(vaultInfo.vaultAddress, vaultInfo)
	})

	return {
		markets: coreData.wasm.markets,
		masterBalance: coreData.bank.balance,
		prices: coreData.wasm.prices,
		creditLines: coreData.wasm.creditLines.filter((debt) => debt.uncollateralized),
		creditLineCaps: coreData.wasm.creditLineCaps,
		routes: coreData.wasm.routes,
		vaultInfo: vaultMap,
		whitelistedAssets: coreData.wasm.whitelistedAssets,
	}
}

export const fetchData = async (
	hiveEndpoint: string,
	address: string,
	redbankAddress: string,
	oracleAddress: string,
	creditManagerAddress?: string,
): Promise<{
	bank: {
		balance: Coin[]
	}
	wasm: {
		markets: MarketInfo[]
		prices: PriceResponse[]
		whitelistedAssets?: string[]
	}
}> => {
	const query = `{
    bank {
      balance(address:"${address}") {
        denom,
        amount
      }
    }
    wasm {
        markets: contractQuery(
            contractAddress: "${redbankAddress}"
            query: { markets: {} }
        ),
        prices: contractQuery(
            contractAddress: "${oracleAddress}"
            query: { prices: {} }
        ),
        ${
					creditManagerAddress
						? `whitelistedAssets: contractQuery(
          contractAddress: "${creditManagerAddress}"
          query: { allowed_coins: {} }
          )`
						: ``
				}
      }
    }`

	const response = await fetch(hiveEndpoint, {
		method: 'post',
		body: JSON.stringify({ query }),
		headers: { 'Content-Type': 'application/json' },
	})

	return (await response.json()).data
}

export const fetchRoverPosition = async (
	accountId: string,
	creditManagerAddress: string,
	hiveEndpoint: string,
): Promise<Positions> => {
	const query = { query: produceRoverAccountPositionQuery(accountId, creditManagerAddress) }
	// post to hive endpoint
	const response = await fetch(hiveEndpoint, {
		method: 'post',
		body: JSON.stringify(query),
		headers: { 'Content-Type': 'application/json' },
	})

	const result = (await response.json()) as {
		data: {
			wasm: {
				position: Positions
			}
		}
	}

	return result.data.wasm.position
}

export const fetchRedbankBatch = async (
	positions: Position[],
	redbankAddress: string,
	hiveEndpoint: string,
): Promise<DataResponse[]> => {
	const queries = positions.map((position) => {
		return {
			query: produceUserPositionQuery(position.Address, redbankAddress),
		}
	})

	const response = await fetch(hiveEndpoint, {
		method: 'post',
		body: JSON.stringify(queries),
		headers: { 'Content-Type': 'application/json' },
	})

	return (await response.json()) as DataResponse[]
}
