import { Position } from './types/position'
import fetch from 'cross-fetch'
import { Positions } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import { Coin } from '@cosmjs/amino'
import { MarketInfo } from './rover/types/MarketInfo'
import { PriceResponse } from './types/creditmanager/generated/mars-mock-oracle/MarsMockOracle.types'

import { NO_ROVER_DATA } from './rover/constants/Errors'

enum QueryType {
	DEBTS,
	COLLATERALS,
}

const DEBTS = 'debts'
const COLLATERALS = 'collaterals'

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

interface VaultInfo {
  vaultAddress : string
  baseToken : string
  vaultToken : string
  balances: Coin[]
  totalSupply: string
}

export interface RoverData {
  masterBalance : Coin[]
  markets: MarketInfo[]
  prices: PriceResponse[]
  whitelistedAssets: string[]
  vaultInfo: Map<string, VaultInfo>
}

interface CoreDataResponse {
  bank : {
    balance : Coin[]
  }
  wasm : {
    markets : MarketInfo[]
    prices : PriceResponse[]
    whitelistedAssets: string[]
  }
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
  )
`
}

const produceVaultQuery = (vaultAddress: string): string => {
  
	return `{
        ${vaultAddress}:bank {
          balance(address:"${vaultAddress}") {
            denom,
            amount
          }
        }
        wasm {
          ${produceVaultTotalSupplySection(vaultAddress)},
          ${produceVaultInfoSection(vaultAddress)},
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

interface VaultInfoBank {
  balance : Coin[]
}

interface VaultInfoWasm {
  totalSupply : string
  info : {
    base_token: string
    vault_token: string
  }
}

interface VaultDataResponse {
  [key:string] : VaultInfoBank | VaultInfoWasm
}

const produceVaultInfo = (vaultResponseData: VaultDataResponse) : VaultInfo => {

  let vaultAddress = ''
  let baseToken = ''
  let vaultToken = ''
  let balances: Coin[] = []
  let totalSupply = ''

  // get the keys - note that our keys will either be the vault address (for the bank module) or 'wasm' for the wasm module
  Object.keys(vaultResponseData).forEach((key : string) => {
    if (key === 'wasm') {
      const wasm : VaultInfoWasm = vaultResponseData[key] as VaultInfoWasm
      totalSupply = wasm.totalSupply
      baseToken = wasm.info.base_token
      vaultToken = wasm.info.vault_token
    } else {
      vaultAddress = key
      const bank : VaultInfoBank = vaultResponseData[key] as VaultInfoBank
      balances = bank.balance
    }
  })
 
  return { vaultAddress, balances, baseToken, totalSupply, vaultToken}
}

const produceCoreRoverDataQuery = (address: string,redbankAddress:string, oracleAddress: string, creditManagerAddress: string) => {
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
}

export const fetchRoverData = async (
	hiveEndpoint: string,
	address: string,
	redbankAddress: string,
	oracleAddress: string,
	creditManagerAddress: string,
  vaultAddresses: string[]
): Promise<RoverData> => {
  vaultAddresses.push("osmo1w95u2w477a852mpex72t4u0qs0vyjkme4gq4m2ltgf84km47wf0sgkx2ap")
	
  const coreQuery = produceCoreRoverDataQuery(address, redbankAddress, oracleAddress, creditManagerAddress)

  const queries = vaultAddresses.map((vault) => {
		return {
			query: produceVaultQuery(vault),
		}
	})

  queries.push({query : coreQuery})

	const response = await fetch(hiveEndpoint, {
		method: 'post',
		body: JSON.stringify( queries ),
		headers: { 'Content-Type': 'application/json' },
	})

  const result : {data : CoreDataResponse | VaultDataResponse}[] = await response.json()

  if (result.length === 0) {
    throw new Error(NO_ROVER_DATA)
  }
  const coreData : CoreDataResponse = result.pop()!.data as CoreDataResponse

  const vaultMap = new Map<string, VaultInfo>()

  result.forEach((vaultResponse) => {
    const vaultInfo : VaultInfo = produceVaultInfo(vaultResponse.data as VaultDataResponse)
    vaultMap.set(vaultInfo.vaultAddress, vaultInfo)
  })

	return {
    markets: coreData.wasm.markets,
    masterBalance: coreData.bank.balance,
    prices: coreData.wasm.prices,
    vaultInfo: vaultMap,
    whitelistedAssets: coreData.wasm.whitelistedAssets
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
