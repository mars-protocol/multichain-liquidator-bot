"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomPosition = exports.generateRandomAsset = void 0;
const generateRandomAsset = () => {
    return {
        denom: Math.random().toString(),
        amount: Math.random().toFixed(0),
        amount_scaled: '0',
    };
};
exports.generateRandomAsset = generateRandomAsset;
const generateRandomPosition = () => {
    return {
        Identifier: Math.random().toString(),
    };
};
exports.generateRandomPosition = generateRandomPosition;
//# sourceMappingURL=testHelpers.js.map