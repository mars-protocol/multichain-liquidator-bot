"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.produceRoverAccountPositionQuery = exports.produceVaultQuery = exports.produceCoreRoverDataQuery = void 0;
const produceCoreRoverDataQuery = (address, redbankAddress, oracleAddress, creditManagerAddress, swapperAddress) => {
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
    }`;
};
exports.produceCoreRoverDataQuery = produceCoreRoverDataQuery;
const produceVaultTotalSupplySection = (vaultAddress) => {
    return `
  totalSupply:contractQuery(
      contractAddress: "${vaultAddress}"
      query: { total_vault_token_supply : { } }
  )
`;
};
const produceVaultInfoSection = (vaultAddress) => {
    return `
        info:contractQuery(
            contractAddress: "${vaultAddress}"
            query: { info : { } }
        ),`;
};
const produceVaultRedeemSection = (vaultAddress, redeemAmount) => {
    return ` 
  redeem:contractQuery(
    contractAddress: "${vaultAddress}"
    query: {  preview_redeem: {amount:"${redeemAmount}"} }
)`;
};
const produceVaultQuery = (vaultAddress, redeemAmount) => {
    return `{
        ${vaultAddress}:wasm {
          ${produceVaultTotalSupplySection(vaultAddress)},
          ${produceVaultInfoSection(vaultAddress)},
          ${produceVaultRedeemSection(vaultAddress, redeemAmount)}
        }
    }`;
};
exports.produceVaultQuery = produceVaultQuery;
const produceRoverAccountPositionQuery = (account_id, cmAddress) => {
    return `{
          wasm {
            position: contractQuery(
              contractAddress: "${cmAddress}"
              query: { positions: { account_id: "${account_id}" } }
          )
          }
        } 
    `;
};
exports.produceRoverAccountPositionQuery = produceRoverAccountPositionQuery;
//# sourceMappingURL=rover.js.map