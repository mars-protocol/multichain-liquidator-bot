"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.produceRedbankGeneralQuery = exports.produceBalanceQuery = exports.produceUserPositionQuery = void 0;
const constants_1 = require("../../constants");
const getTypeString = (queryType) => {
    return queryType == constants_1.QueryType.COLLATERALS ? constants_1.COLLATERALS : constants_1.DEBTS;
};
const produceUserPositionQuery = (user, redbankAddress) => {
    return `{
        ${user}:wasm {
        ${producePositionQuerySection(user, constants_1.QueryType.DEBTS, redbankAddress)},
        ${producePositionQuerySection(user, constants_1.QueryType.COLLATERALS, redbankAddress)}
        }
    }`;
};
exports.produceUserPositionQuery = produceUserPositionQuery;
const produceBalanceQuery = (address) => {
    return `{
    ${address}:bank {
      balance(address:"${address}") {
        amount
        denom
      }
    }
}`;
};
exports.produceBalanceQuery = produceBalanceQuery;
const produceRedbankGeneralQuery = (address, redbankAddress, oracleAddress) => {
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
                query: { markets: { limit : 50 } }
            ),
            prices: contractQuery(
                contractAddress: "${oracleAddress}"
                query: { prices: { limit : 50 } }
            )
          }
        }`;
};
exports.produceRedbankGeneralQuery = produceRedbankGeneralQuery;
const producePositionQuerySection = (user, queryType, redbankAddress) => {
    const typeString = getTypeString(queryType);
    return `
        ${typeString}:contractQuery(
            contractAddress: "${redbankAddress}"
            query: { user_${typeString}: { user: "${user}" } }
        )
    `;
};
//# sourceMappingURL=redbank.js.map