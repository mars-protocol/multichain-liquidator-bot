import { Position } from './types/position'
import fetch from 'node-fetch'
import { Positions } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
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

const getTypeString = (queryType: QueryType): string => {
  return queryType == QueryType.COLLATERALS ? COLLATERALS : DEBTS
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

export const fetchRoverPosition = async (
  accountId: string,
  creditManagerAddress: string,
  hiveEndpoint: string
): Promise<Positions> => {
  const query = {query:produceRoverAccountPositionQuery(accountId, creditManagerAddress)}
  // post to hive endpoint
  console.log(query)
  const response = await fetch(hiveEndpoint, {
    method: 'post',
    body: JSON.stringify(query),
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await response.json() as {
    data : {
      wasm : {
        position : Positions
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

  return await response.json() as DataResponse[]
}
