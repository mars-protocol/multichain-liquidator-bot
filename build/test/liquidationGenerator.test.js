"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const liquidationGenerator_1 = require("../src/liquidationGenerator");
const testHelpers_1 = require("./testHelpers");
describe('Liquidation Tx Generator Tests..', () => {
    test('Can get largest colallateral correctly', () => {
        const collateralA = { ...(0, testHelpers_1.generateRandomAsset)(), enabled: true };
        const collateralB = { ...(0, testHelpers_1.generateRandomAsset)(), enabled: true };
        const prices = new Map();
        prices.set(collateralA.denom, 1);
        prices.set(collateralB.denom, 2);
        const assets = [collateralA, collateralB];
        const largestIndex = collateralA.amount > collateralB.amount ? 0 : 1;
        const largestCollateral = (0, liquidationGenerator_1.getLargestCollateral)(assets, prices);
        expect(largestCollateral).toBe(assets[largestIndex].denom);
    }),
        test('Can get largest debt correctly', () => {
            const debtA = { ...(0, testHelpers_1.generateRandomAsset)(), uncollateralised: false };
            const debtB = { ...(0, testHelpers_1.generateRandomAsset)(), uncollateralised: false };
            const prices = new Map();
            prices.set(debtA.denom, 1);
            prices.set(debtB.denom, 2);
            const assets = [debtA, debtB];
            const largestIndex = debtA.amount > debtB.amount ? 0 : 1;
            const largestCollateral = (0, liquidationGenerator_1.getLargestDebt)(assets, prices).denom;
            expect(largestCollateral).toBe(assets[largestIndex].denom);
        });
});
//# sourceMappingURL=liquidationGenerator.test.js.map