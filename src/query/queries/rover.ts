export const produceCoreRoverDataQuery = (
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
            query: { markets: { limit : 50 } }
        ),
        prices: contractQuery(
            contractAddress: "${oracleAddress}"
            query: { prices: { limit : 50 } }
        ),
        creditLines: contractQuery(
          contractAddress: "${redbankAddress}"
          query: { user_debts: { user :"${creditManagerAddress}"} }
        ),
        whitelistedAssets: contractQuery(
          contractAddress: "${creditManagerAddress}"
          query: { allowed_coins: { limit : 50 } }
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
        ),`
}

const produceVaultRedeemSection = (vaultAddress: string, redeemAmount: string): string => {
	return ` 
  redeem:contractQuery(
    contractAddress: "${vaultAddress}"
    query: {  preview_redeem: {amount:"${redeemAmount}"} }
)`
}

export const produceVaultQuery = (vaultAddress: string, redeemAmount: string): string => {
	return `{
        ${vaultAddress}:wasm {
          ${produceVaultTotalSupplySection(vaultAddress)},
          ${produceVaultInfoSection(vaultAddress)},
          ${produceVaultRedeemSection(vaultAddress, redeemAmount)}
        }
    }`
}

export const produceRoverAccountPositionQuery = (account_id: string, cmAddress: string): string => {
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
