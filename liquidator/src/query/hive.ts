import { Position } from '../types/position'
import fetch from 'cross-fetch'
import { Coin, Positions } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import { MarketInfo } from '../rover/types/MarketInfo'
import { PriceResponse } from 'marsjs-types/creditmanager/generated/mars-mock-oracle/MarsMockOracle.types'
import { NO_ROVER_DATA } from '../rover/constants/errors'
import BigNumber from 'bignumber.js'
import {
	produceCoreRoverDataQuery,
	produceRoverAccountPositionQuery,
	produceVaultQuery,
} from './queries/rover'
import { REDEEM_BASE } from '../constants'
import { produceBalanceQuery, produceRedbankGeneralQuery, produceUserPositionQuery } from './queries/redbank'
import {
	CoreDataResponse,
	DataResponse,
	LiquidatorBalanceResponse,
	RoverData,
	VaultDataResponse,
	VaultInfo,
	VaultInfoWasm,
} from './types'

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
			query: produceVaultQuery(vault, REDEEM_BASE),
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

export const fetchRedbankData = async (
	hiveEndpoint: string,
	address: string,
	redbankAddress: string,
	oracleAddress: string,
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
	const query = produceRedbankGeneralQuery(address, redbankAddress, oracleAddress)
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

export const fetchBalances = async (hiveEndpoint: string, addresses: string[]) : Promise<Map<string, Coin[]>> => {

	const queries = addresses.map((address) => {
		return {
			query: produceBalanceQuery(address),
		}
	})

	const response = await fetch(hiveEndpoint, {
		method: 'post',
		body: JSON.stringify(queries),
		headers: { 'Content-Type': 'application/json' },
	})

	const resultJson = await response.json() as {data : LiquidatorBalanceResponse} []
	const balancesMap : Map<string, Coin[]>= new Map()
	
	resultJson.forEach((result) => {
		const liquidatorAddress : string = Object.keys(result.data).pop()!
		const coins : Coin[] = result.data[liquidatorAddress].balance
		balancesMap.set(liquidatorAddress, coins)
	})

	return balancesMap
}
