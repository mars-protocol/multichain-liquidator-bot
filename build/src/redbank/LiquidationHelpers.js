"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTotalValueOfCoinArray = exports.getLiquidationThresholdHealthFactor = exports.getTotalLiquidationThresholdValueOfCollateral = exports.getTotalLtvValueOfCollateral = exports.calculateLiquidationBonus = exports.calculateMaxDebtRepayable = exports.calculateCollateralRatio = exports.calculatePositionLtv = void 0;
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const calculatePositionLtv = (debts, collaterals, prices, assetParams) => {
    const totalDebtValue = (0, exports.getTotalValueOfCoinArray)(debts, prices);
    const totalCollateralValue = (0, exports.getTotalLtvValueOfCollateral)(collaterals, prices, assetParams);
    return totalCollateralValue.dividedBy(totalDebtValue).toNumber();
};
exports.calculatePositionLtv = calculatePositionLtv;
const calculateCollateralRatio = (debts, collaterals, prices) => {
    const totalDebtValue = (0, exports.getTotalValueOfCoinArray)(debts, prices);
    const totalCollateralValue = (0, exports.getTotalValueOfCoinArray)(collaterals, prices);
    return totalCollateralValue.dividedBy(totalDebtValue);
};
exports.calculateCollateralRatio = calculateCollateralRatio;
const calculateMaxDebtRepayable = (targetHealthFactor, debts, collaterals, assetParams, liquidationBonus, prices, claimedCollateralDenom) => {
    const totalDebtValue = (0, exports.getTotalValueOfCoinArray)(debts, prices);
    const ltCollateralValue = (0, exports.getTotalLiquidationThresholdValueOfCollateral)(collaterals, prices, assetParams);
    const thf = new bignumber_js_1.default(targetHealthFactor);
    const lt = new bignumber_js_1.default(assetParams.get(claimedCollateralDenom)?.liquidation_threshold || 0);
    const numerator = thf.multipliedBy(totalDebtValue).minus(ltCollateralValue);
    const denominator = thf.minus(lt.multipliedBy(1 + liquidationBonus));
    return numerator.dividedBy(denominator);
};
exports.calculateMaxDebtRepayable = calculateMaxDebtRepayable;
const calculateLiquidationBonus = (bonusStart, slope, healthFactor, maxLbSetting, minLbSetting, collateralRatio) => {
    const maxLBCalc = Math.max(Math.min(collateralRatio - 1, maxLbSetting), minLbSetting);
    const liquidationBonus = Math.min(bonusStart + (slope * (1 - healthFactor)), maxLBCalc);
    return liquidationBonus;
};
exports.calculateLiquidationBonus = calculateLiquidationBonus;
const getTotalLtvValueOfCollateral = (collateral, prices, assetParams) => {
    return collateral.reduce((acc, collateral) => {
        if (collateral.enabled === false)
            return acc;
        const price = new bignumber_js_1.default(prices.get(collateral.denom) || 0);
        const value = new bignumber_js_1.default(collateral.amount).multipliedBy(price);
        const assetLtv = new bignumber_js_1.default(assetParams.get(collateral.denom)?.max_loan_to_value || 0);
        return acc.plus(value.multipliedBy(assetLtv));
    }, new bignumber_js_1.default(0));
};
exports.getTotalLtvValueOfCollateral = getTotalLtvValueOfCollateral;
const getTotalLiquidationThresholdValueOfCollateral = (collateral, prices, assetParams) => {
    return collateral.reduce((acc, collateral) => {
        if (collateral.enabled === false)
            return acc;
        const price = new bignumber_js_1.default(prices.get(collateral.denom) || 0);
        const value = new bignumber_js_1.default(collateral.amount).multipliedBy(price);
        const liquidationThreshold = new bignumber_js_1.default(assetParams.get(collateral.denom)?.liquidation_threshold || 0);
        return acc.plus(value.multipliedBy(liquidationThreshold));
    }, new bignumber_js_1.default(0));
};
exports.getTotalLiquidationThresholdValueOfCollateral = getTotalLiquidationThresholdValueOfCollateral;
const getLiquidationThresholdHealthFactor = (collateral, debts, prices, assetParams) => {
    const totalDebtValue = (0, exports.getTotalValueOfCoinArray)(debts, prices);
    const totalCollateralValue = (0, exports.getTotalLiquidationThresholdValueOfCollateral)(collateral, prices, assetParams);
    return totalCollateralValue.dividedBy(totalDebtValue).toNumber();
};
exports.getLiquidationThresholdHealthFactor = getLiquidationThresholdHealthFactor;
const getTotalValueOfCoinArray = (coins, prices) => {
    return coins.reduce((acc, debt) => {
        const price = new bignumber_js_1.default(prices.get(debt.denom) || 0);
        const value = new bignumber_js_1.default(debt.amount).multipliedBy(price);
        return acc.plus(value);
    }, new bignumber_js_1.default(0));
};
exports.getTotalValueOfCoinArray = getTotalValueOfCoinArray;
//# sourceMappingURL=LiquidationHelpers.js.map