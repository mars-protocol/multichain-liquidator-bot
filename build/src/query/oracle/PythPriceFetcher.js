"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythPriceFetcher = void 0;
const bignumber_js_1 = __importDefault(require("bignumber.js"));
class PythPriceFetcher {
    async fetchPrice(params) {
        const pythPriceUrl = `https://xc-mainnet.pyth.network/api/latest_price_feeds?ids[]=${params.priceFeedId}`;
        const response = await fetch(pythPriceUrl);
        const pythPriceResults = await response.json();
        const priceResult = pythPriceResults[0].price;
        const correctedExpo = Number(priceResult.expo) + (6 - params.denomDecimals);
        const oraclePrice = new bignumber_js_1.default(10 ^ correctedExpo).multipliedBy(priceResult.price);
        return {
            denom: params.denom,
            price: oraclePrice
        };
    }
}
exports.PythPriceFetcher = PythPriceFetcher;
//# sourceMappingURL=PythPriceFetcher.js.map