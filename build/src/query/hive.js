"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchBalances = exports.fetchRedbankBatch = exports.fetchRoverPosition = exports.fetchRedbankData = exports.fetchRoverData = void 0;
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const errors_1 = require("../rover/constants/errors");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const rover_1 = require("./queries/rover");
const constants_1 = require("../constants");
const redbank_1 = require("./queries/redbank");
const produceVaultInfo = (vaultResponseData) => {
    const vaultAddress = Object.keys(vaultResponseData)[0];
    const wasm = vaultResponseData[vaultAddress];
    const totalSupply = wasm.totalSupply;
    const baseToken = wasm.info.base_token;
    const vaultToken = wasm.info.vault_token;
    const lpShareToVaultShareRatio = new bignumber_js_1.default(wasm.redeem).dividedBy(constants_1.REDEEM_BASE);
    return { vaultAddress, baseToken, totalSupply, vaultToken, lpShareToVaultShareRatio };
};
const fetchRoverData = async (hiveEndpoint, address, redbankAddress, oracleAddress, creditManagerAddress, swapperAddress, vaultAddresses) => {
    const coreQuery = (0, rover_1.produceCoreRoverDataQuery)(address, redbankAddress, oracleAddress, creditManagerAddress, swapperAddress);
    const queries = vaultAddresses.map((vault) => {
        return {
            query: (0, rover_1.produceVaultQuery)(vault, constants_1.REDEEM_BASE),
        };
    });
    queries.push({ query: coreQuery });
    const response = await (0, cross_fetch_1.default)(hiveEndpoint, {
        method: 'post',
        body: JSON.stringify(queries),
        headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json();
    if (result.length === 0) {
        throw new Error(errors_1.NO_ROVER_DATA);
    }
    const coreData = result.pop().data;
    const vaultMap = new Map();
    result.forEach((vaultResponse) => {
        const vaultInfo = produceVaultInfo(vaultResponse.data);
        vaultMap.set(vaultInfo.vaultAddress, vaultInfo);
    });
    return {
        markets: coreData.wasm.markets,
        masterBalance: coreData.bank.balance,
        prices: coreData.wasm.prices,
        creditLines: coreData.wasm.creditLines.filter((debt) => debt.uncollateralized),
        creditLineCaps: coreData.wasm.creditLineCaps,
        routes: coreData.wasm.routes,
        vaultInfo: vaultMap,
        whitelistedAssets: coreData.wasm.whitelistedAssets,
    };
};
exports.fetchRoverData = fetchRoverData;
const fetchRedbankData = async (hiveEndpoint, address, redbankAddress, oracleAddress) => {
    const query = (0, redbank_1.produceRedbankGeneralQuery)(address, redbankAddress, oracleAddress);
    const response = await (0, cross_fetch_1.default)(hiveEndpoint, {
        method: 'post',
        body: JSON.stringify({ query }),
        headers: { 'Content-Type': 'application/json' },
    });
    return (await response.json()).data;
};
exports.fetchRedbankData = fetchRedbankData;
const fetchRoverPosition = async (accountId, creditManagerAddress, hiveEndpoint) => {
    const query = { query: (0, rover_1.produceRoverAccountPositionQuery)(accountId, creditManagerAddress) };
    const response = await (0, cross_fetch_1.default)(hiveEndpoint, {
        method: 'post',
        body: JSON.stringify(query),
        headers: { 'Content-Type': 'application/json' },
    });
    const result = (await response.json());
    return result.data.wasm.position;
};
exports.fetchRoverPosition = fetchRoverPosition;
const fetchRedbankBatch = async (positions, redbankAddress, hiveEndpoint) => {
    const queries = positions.map((position) => {
        return {
            query: (0, redbank_1.produceUserPositionQuery)(position.Identifier, redbankAddress),
        };
    });
    const response = await (0, cross_fetch_1.default)(hiveEndpoint, {
        method: 'post',
        body: JSON.stringify(queries),
        headers: { 'Content-Type': 'application/json' },
    });
    return (await response.json());
};
exports.fetchRedbankBatch = fetchRedbankBatch;
const fetchBalances = async (hiveEndpoint, addresses) => {
    const queries = addresses.map((address) => {
        return {
            query: (0, redbank_1.produceBalanceQuery)(address),
        };
    });
    const response = await (0, cross_fetch_1.default)(hiveEndpoint, {
        method: 'post',
        body: JSON.stringify(queries),
        headers: { 'Content-Type': 'application/json' },
    });
    const resultJson = await response.json();
    const balancesMap = new Map();
    resultJson.forEach((result) => {
        const liquidatorAddress = Object.keys(result.data).pop();
        const coins = result.data[liquidatorAddress].balance;
        balancesMap.set(liquidatorAddress, coins);
    });
    return balancesMap;
};
exports.fetchBalances = fetchBalances;
//# sourceMappingURL=hive.js.map