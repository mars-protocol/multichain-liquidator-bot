"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OsmosisOraclePriceFetcher = void 0;
const bignumber_js_1 = __importDefault(require("bignumber.js"));
class OsmosisOraclePriceFetcher {
    constructor(client) {
        this.client = client;
    }
    async fetchPrice(params) {
        const result = await this.client.queryContractSmart(params.oracleAddress, { price: { denom: params.priceDenom } });
        return {
            denom: result.denom,
            price: new bignumber_js_1.default(result.price)
        };
    }
}
exports.OsmosisOraclePriceFetcher = OsmosisOraclePriceFetcher;
//# sourceMappingURL=OsmosisOraclePriceFetcher.js.map