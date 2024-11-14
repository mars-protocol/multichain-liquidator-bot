import { COLLATERALS, DEBTS, QueryType } from '../../constants'

const getTypeString = (queryType: QueryType): string => {
	return queryType == QueryType.COLLATERALS ? COLLATERALS : DEBTS
}

export const produceUserPositionQuery = (user: string, redbankAddress: string): string => {
	return `{
        ${user}:wasm {
        ${producePositionQuerySection(user, QueryType.DEBTS, redbankAddress)},
        ${producePositionQuerySection(user, QueryType.COLLATERALS, redbankAddress)}
        }
    }`
}

export const produceBalanceQuery = (address: string): string => {
	return `{
    ${address}:bank {
      balance(address:"${address}") {
        amount
        denom
      }
    }
}`
}

export const produceRedbankGeneralQuery = (address: string, redbankAddress: string) => {
	return `{
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
      }
    }`
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
