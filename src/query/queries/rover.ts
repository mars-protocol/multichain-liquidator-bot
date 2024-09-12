export const produceCoreRoverDataQuery = (
	address: string,
	redbankAddress: string,
	swapperAddress: string,
  params_address: string,
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
        whitelistedAssets: contractQuery(
          contractAddress: "${params_address}"
          query: { all_asset_params: {} }
        ),
        routes: contractQuery(
          contractAddress: "${swapperAddress}"
          query: { routes: {
            limit: 100
          } }
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
