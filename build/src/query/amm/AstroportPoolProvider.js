"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstroportPoolProvider = void 0;
const helpers_1 = require("../../helpers");
const Pool_1 = require("../../types/Pool");
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const utils_1 = require("../utils");
class AstroportPoolProvider {
    constructor(astroportFactory, graphqlEndpoint, lcdEndpoint) {
        this.astroportFactory = astroportFactory;
        this.graphqlEndpoint = graphqlEndpoint;
        this.lcdEndpoint = lcdEndpoint;
        this.maxRetries = 8;
        this.pairs = [];
        this.initiate = async () => {
            this.pairs = await this.fetchPairContracts(this.astroportFactory);
            setInterval(() => { this.fetchPairContracts(this.astroportFactory); }, 1000 * 60 * 30);
        };
        this.setPairs = (pairs) => {
            this.pairs = pairs;
        };
        this.getPairs = () => {
            return this.pairs;
        };
        this.create_pool_query_promise = async (query, contractAddress) => {
            return {
                contractAddress,
                result: await query
            };
        };
        this.loadPools = async () => {
            if (this.pairs.length === 0) {
                throw new Error("Pools still not loaded. Ensure you have called initiate()");
            }
            const poolQueryPromises = this.pairs.map((pair) => this.create_pool_query_promise((0, utils_1.queryWasmLcd)(this.lcdEndpoint, pair.contract_addr, this.objectToBase64({
                pool: {}
            })), pair.contract_addr));
            let poolResponses = await Promise.all(poolQueryPromises);
            return poolResponses
                .filter((poolResponse) => poolResponse.result.data)
                .map((poolResponse, index) => {
                const poolAssets = this.producePoolAssets(poolResponse.result.data.assets);
                const pool = {
                    address: poolResponse.contractAddress,
                    id: index,
                    poolAssets: poolAssets,
                    swapFee: "0.003",
                    token0: poolAssets[0].token.denom,
                    token1: poolAssets[1].token.denom,
                    poolType: Pool_1.PoolType.XYK
                };
                return pool;
            });
        };
        this.producePairQuery = (startAfter, limit, contractAddress) => {
            const variables = {
                contractAddress,
                limit
            };
            const query = `
            query ($contractAddress: String!, $limit: Int!){
                wasm {
                    contractQuery(
                        contractAddress: $contractAddress, 
                        query: {
                            pairs: {
                                    limit: $limit
                                    start_after: ${startAfter}
                                }
                        }
                    )
                }
            }
        `;
            return { query: query, variables: variables };
        };
        this.findLatestPair = (pairs) => {
            if (pairs.length === 0) {
                return null;
            }
            const latestAssetInfos = this.pairs[this.pairs.length - 1].asset_infos;
            let startAfter = `[
                    ${this.produceStartAfterAsset(latestAssetInfos[0])},
                    ${this.produceStartAfterAsset(latestAssetInfos[1])}
        ]`;
            return startAfter;
        };
        this.produceStartAfterAsset = (asset) => {
            if ("token" in asset) {
                return `{
                token: {
                    contract_addr: "${asset.token.contract_addr}"
                }
            }`;
            }
            else {
                return `{
                native_token: {
                    denom: "${asset.native_token.denom}"
                }
            }`;
            }
        };
        this.producePoolAssets = (assets) => {
            return assets.map((asset) => {
                if ("token" in asset.info) {
                    return {
                        token: {
                            denom: asset.info.token.contract_addr,
                            amount: asset.amount
                        }
                    };
                }
                else {
                    return {
                        token: {
                            denom: asset.info.native_token.denom,
                            amount: asset.amount
                        }
                    };
                }
            });
        };
    }
    objectToBase64(obj) {
        const jsonString = JSON.stringify(obj);
        const base64String = Buffer.from(jsonString).toString('base64');
        return base64String;
    }
    async fetchPairContracts(contractAddress, limit = 10) {
        let startAfter = this.findLatestPair(this.pairs);
        let retries = 0;
        const pairs = [];
        while (retries < this.maxRetries) {
            try {
                const query = this.producePairQuery(startAfter, limit, contractAddress);
                const response = await (0, cross_fetch_1.default)(this.graphqlEndpoint, {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(query),
                });
                const responseData = await response.json();
                const contractQueryData = responseData.data.wasm.contractQuery;
                const batchPairs = contractQueryData.pairs
                    .filter((pair) => pair.pair_type.xyk !== undefined);
                if (batchPairs.length === 0) {
                    return pairs;
                }
                else {
                    batchPairs.forEach((pair) => {
                        pairs.push(pair);
                    });
                    let assets = pairs[pairs.length - 1].asset_infos;
                    startAfter = `[
                    ${this.produceStartAfterAsset(assets[0])},
                    ${this.produceStartAfterAsset(assets[1])}
                ]`;
                }
            }
            catch (error) {
                console.error(error);
                retries += 1;
                await (0, helpers_1.sleep)(1000);
            }
        }
        return pairs;
    }
}
exports.AstroportPoolProvider = AstroportPoolProvider;
//# sourceMappingURL=AstroportPoolProvider.js.map