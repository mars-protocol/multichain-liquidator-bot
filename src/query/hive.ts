import { Position } from '../types/position'
import fetch from 'cross-fetch'
import { Coin, Positions } from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import { MarketInfo } from '../rover/types/MarketInfo'
import { NO_ROVER_DATA } from '../rover/constants/errors'
import BigNumber from 'bignumber.js'
import {
	produceCoreRoverDataQuery,
	produceRoverAccountPositionQuery,
	produceVaultQuery,
} from './queries/rover'
import { REDEEM_BASE } from '../constants'
import { produceRedbankGeneralQuery, produceUserPositionQuery } from './queries/redbank'
import {
	CoreDataResponse,
	DataResponse,
	RoverData,
	VaultDataResponse,
	VaultInfo,
	VaultInfoWasm,
} from './types'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'

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
	swapperAddress: string,
	vaultAddresses: string[],
	params_address: string,
): Promise<RoverData> => {
	const coreQuery = produceCoreRoverDataQuery(
		address,
		redbankAddress,
		swapperAddress,
		params_address,
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
		routes: coreData.wasm.routes,
		vaultInfo: vaultMap,
		whitelistedAssets: [],
	}
}

export const fetchRedbankData = async (
	hiveEndpoint: string,
	address: string,
	redbankAddress: string,
): Promise<{
	bank: {
		balance: Coin[]
	}
	wasm: {
		markets: MarketInfo[]
		whitelistedAssets?: string[]
	}
}> => {
	const query = produceRedbankGeneralQuery(address, redbankAddress)
	const response = await fetch(hiveEndpoint, {
		method: 'post',
		body: JSON.stringify({ query }),
		headers: { 'Content-Type': 'application/json' },
	})
	const myData = await response.json()
	return myData.data
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
			query: produceUserPositionQuery(position.Identifier, redbankAddress),
		}
	})

	const response = await fetch(hiveEndpoint, {
		method: 'post',
		body: JSON.stringify(queries),
		headers: { 'Content-Type': 'application/json' },
	})

	return (await response.json()) as DataResponse[]
}

export const fetchBalances = async (
	client: CosmWasmClient,
	addresses: string[],
	gasDenom: string,
): Promise<Map<string, Coin[]>> => {
	const promises = addresses.map(async (address) => {
		return { address, coin: await client.getBalance(address, gasDenom) }
	})

	const balances = await Promise.all(promises)
	const balancesMap: Map<string, Coin[]> = new Map()

	balances.forEach((balance) => {
		// @ts-ignore
		balancesMap.set(balance.address, [balance.coin])
	})

	return balancesMap
}
