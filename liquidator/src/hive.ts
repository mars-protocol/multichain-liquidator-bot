import { Position } from "./types/position"

enum QueryType {
    DEBTS,
    COLLATERALS
}

const DEBTS = 'debts'
const COLLATERALS = 'collaterals'

interface AssetResponse {
    denom : string
    amount_scaled: string
    amount: string,
}

interface Debts extends AssetResponse{
    uncollateralised: boolean
}
interface Collaterals extends AssetResponse{
    enabled: boolean
}

interface UserPositionData {
    [key: string]: {
        debts : Debts
        collaterals: Collaterals
    }
}

interface DataResponse {
    data : UserPositionData
}

const getTypeString = (queryType : QueryType): string => {
    return queryType == QueryType.COLLATERALS ? COLLATERALS : DEBTS
}
  
const produceUserPositionQuery = (user: string, redbankAddress: string) : string => {
    return `{
        ${user}:wasm {
        ${producePositionQuerySection(user, QueryType.DEBTS, redbankAddress)},
        ${producePositionQuerySection(user, QueryType.COLLATERALS, redbankAddress)}
        }
    }`
}

const producePositionQuerySection = (user: string, queryType : QueryType, redbankAddress: string) => {
    const typeString = getTypeString(queryType)
    return `
        ${typeString}:contractQuery(
            contractAddress: "${redbankAddress}"
            query: { user_${typeString}: { user: "${user}" } }
        )
    `
}

export const fetchBatch = async(positions: Position[], redbankAddress: string, hiveEndpoint: string) : Promise<DataResponse[]> => {
    const queries = positions.map((position) => {
        return {
            query: produceUserPositionQuery(position.Address,redbankAddress)
        }
    })

    // post to hive endpoint
    const response = await fetch(hiveEndpoint, {
        method: 'post',
        body: JSON.stringify(queries),
        headers: {'Content-Type': 'application/json'}
    });

    return await response.json()
}