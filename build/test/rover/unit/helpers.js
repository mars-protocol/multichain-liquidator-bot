"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomCreditLineCap = exports.generateRandomCreditLine = exports.generateRandomMarket = void 0;
const generateRandomMarket = (denom) => {
    return {
        denom: denom ? denom : Math.random().toString(),
        borrow_enabled: Math.random() > 0.5,
        deposit_enabled: Math.random() > 0.5,
        borrow_index: Math.random().toString(),
        borrow_rate: Math.random().toString(),
        collateral_total_scaled: Math.random().toString(),
        debt_total_scaled: Math.random().toString(),
        deposit_cap: Math.random().toString(),
        indexes_last_updated: Math.random(),
        interest_rate_model: {},
        liquidation_bonus: Math.random().toString(),
        liquidation_threshold: Math.random().toString(),
        liquidity_index: Math.random().toString(),
        liquidity_rate: Math.random().toString(),
        max_loan_to_value: Math.random().toString(),
        available_liquidity: Math.random() * 100000,
    };
};
exports.generateRandomMarket = generateRandomMarket;
const generateRandomCreditLine = (denom = 'atom', amount = '1000000000') => {
    return {
        amount,
        amount_scaled: 'not used',
        denom,
        uncollateralized: true,
    };
};
exports.generateRandomCreditLine = generateRandomCreditLine;
const generateRandomCreditLineCap = (denom = 'uatom', limit = '1000000000') => {
    return {
        denom,
        limit,
    };
};
exports.generateRandomCreditLineCap = generateRandomCreditLineCap;
//# sourceMappingURL=helpers.js.map