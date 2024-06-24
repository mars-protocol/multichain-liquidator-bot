"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLargestDebt = exports.getLargestCollateral = void 0;
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const sortAssetArrayByAmount = (assets, prices) => {
    const assetClone = [...assets];
    return assetClone
        .sort((a, b) => new bignumber_js_1.default(a.amount)
        .multipliedBy(prices.get(a.denom) || 0)
        .minus(b.amount)
        .toNumber())
        .reverse();
};
const getLargestCollateral = (collaterals, prices) => {
    return sortAssetArrayByAmount(collaterals, prices)[0].denom;
};
exports.getLargestCollateral = getLargestCollateral;
const getLargestDebt = (debts, prices) => {
    return sortAssetArrayByAmount(debts, prices)[0];
};
exports.getLargestDebt = getLargestDebt;
//# sourceMappingURL=liquidationGenerator.js.map