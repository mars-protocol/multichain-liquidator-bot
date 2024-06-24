"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const LiquidationHelpers_1 = require("../../../src/redbank/LiquidationHelpers");
describe('Redbank Executor Tests', () => {
    test('Calculate Max Repayable debt', () => {
        const targetHealthFactor = 1.2;
        const b = 0.01;
        const slope = 2;
        const minLB = 0.02;
        const maxLB = 0.1;
        const collaterals = [
            { denom: 'uosmo', amount: '10000', enabled: true },
            { denom: 'ujake', amount: '2000', enabled: true },
            { denom: 'uatom', amount: '900', enabled: true },
        ];
        const debts = [
            { denom: 'uusdc', amount: '3000' },
            { denom: 'untrn', amount: '1200' },
        ];
        const prices = new Map([
            ['uosmo', 3],
            ['ujake', 1],
            ['uatom', 8.2],
            ['uusdc', 8.5],
            ['untrn', 5.5]
        ]);
        const assetLts = new Map([
            ['uosmo', { liquidation_threshold: 0.78 }],
            ['ujake', { liquidation_threshold: 0.55 }],
            ['uatom', { liquidation_threshold: 0.9 }]
        ]);
        const ltHealthFactor = (0, LiquidationHelpers_1.getLiquidationThresholdHealthFactor)(collaterals, debts, prices, assetLts);
        const liquidationBonus = (0, LiquidationHelpers_1.calculateLiquidationBonus)(b, slope, ltHealthFactor, maxLB, minLB, (0, LiquidationHelpers_1.calculateCollateralRatio)(debts, collaterals, prices).toNumber());
        expect(liquidationBonus.toFixed(10)).toBe('0.0696884735');
        const maxRepayableAmount = (0, LiquidationHelpers_1.calculateMaxDebtRepayable)(targetHealthFactor, debts, collaterals, assetLts, liquidationBonus, prices, 'uosmo');
        expect(maxRepayableAmount.toFixed(0)).toBe('20178');
    });
});
//# sourceMappingURL=redbankExecutor.test.js.map