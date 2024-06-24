"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AmmRouter_1 = require("../../../src/AmmRouter");
const LiquidationActionGenerator_1 = require("../../../src/rover/LiquidationActionGenerator");
const helpers_1 = require("./helpers");
const RoverPosition_1 = require("../../../src/rover/types/RoverPosition");
const Pool_1 = require("../../../src/types/Pool");
const long_1 = __importDefault(require("long"));
const errors_1 = require("../../../src/rover/constants/errors");
describe('Liquidation Actions generator Unit Tests', () => {
    const router = new AmmRouter_1.AMMRouter();
    const debtDenom = Math.random().toString();
    const collateralDenom = Math.random().toString();
    const otherDenom = Math.random().toString();
    const debtToRandomAssetPrice = 1.5;
    const randomAssetAmount = 10000000000;
    const poolA = {
        address: 'abc',
        id: new long_1.default(Math.random() * 10000),
        token0: otherDenom,
        token1: debtDenom,
        poolType: Pool_1.PoolType.XYK,
        poolAssets: [
            {
                token: {
                    denom: otherDenom,
                    amount: randomAssetAmount.toString(),
                },
            },
            {
                token: {
                    denom: debtDenom,
                    amount: (randomAssetAmount * debtToRandomAssetPrice).toString(),
                },
            },
        ],
        swapFee: '0.002',
    };
    router.setPools([poolA]);
    describe('Test borrow action generation', () => {
        describe('Direct Borrow', () => {
            test('When we are liquid', () => {
                const markets = [];
                const liquidationActionGenerator = new LiquidationActionGenerator_1.LiquidationActionGenerator(router);
                const debtDenom = Math.random().toString();
                const debtToRepay = 200;
                const collateralDenom = Math.random().toString();
                const collateralAmount = 500;
                const collateral = {
                    type: RoverPosition_1.PositionType.COIN,
                    amount: collateralAmount,
                    closeFactor: 0.5,
                    denom: collateralDenom,
                    price: 1.5,
                    value: 1.5 * collateralAmount,
                };
                const debt = {
                    amount: debtToRepay,
                    denom: debtDenom,
                    price: 1,
                };
                const market = (0, helpers_1.generateRandomMarket)(debtDenom);
                market.available_liquidity = debtToRepay * 1000;
                markets.push(market);
                const borrowActions = liquidationActionGenerator.produceBorrowActions(debt, collateral, markets, [debt.denom, market.denom], [(0, helpers_1.generateRandomCreditLine)(debt.denom), (0, helpers_1.generateRandomCreditLine)(collateral.denom)], [(0, helpers_1.generateRandomCreditLineCap)(debt.denom), (0, helpers_1.generateRandomCreditLineCap)(collateral.denom)]);
                console.log(borrowActions);
                const borrowAction = borrowActions[0];
                expect(borrowActions.length).toBe(1);
                expect(borrowAction.borrow.amount).toBe(debtToRepay.toFixed(0));
                expect(borrowAction.borrow.denom).toBe(debtDenom);
            });
            test('When we are illiquid but > 50% ', () => {
                const markets = [];
                const liquidationActionGenerator = new LiquidationActionGenerator_1.LiquidationActionGenerator(router);
                const debtDenom = Math.random().toString();
                const debtToRepay = 200;
                const collateralDenom = Math.random().toString();
                const collateralAmount = 500;
                const collateral = {
                    type: RoverPosition_1.PositionType.COIN,
                    amount: collateralAmount,
                    closeFactor: 0.5,
                    denom: collateralDenom,
                    price: 1.5,
                    value: 1.5 * collateralAmount,
                };
                const debt = {
                    amount: debtToRepay,
                    denom: debtDenom,
                    price: 1,
                };
                const market = (0, helpers_1.generateRandomMarket)(debtDenom);
                market.available_liquidity = debtToRepay / 1.5;
                markets.push(market);
                const borrowActions = liquidationActionGenerator.produceBorrowActions(debt, collateral, markets, [debt.denom, market.denom], [(0, helpers_1.generateRandomCreditLine)(debt.denom), (0, helpers_1.generateRandomCreditLine)(collateral.denom)], [(0, helpers_1.generateRandomCreditLineCap)(debt.denom), (0, helpers_1.generateRandomCreditLineCap)(collateral.denom)]);
                console.log(borrowActions);
                const borrowAction = borrowActions[0];
                expect(borrowActions.length).toBe(1);
                expect(borrowAction.borrow.amount).toBe(((debtToRepay / 1.5) * 0.99).toFixed(0));
                expect(borrowAction.borrow.denom).toBe(debtDenom);
            });
            test('Correctly calculate repay amount based on collateral reserve factor', () => {
                const markets = [];
                const liquidationActionGenerator = new LiquidationActionGenerator_1.LiquidationActionGenerator(router);
                const debtDenom = Math.random().toString();
                const debtToRepay = 200;
                const collateralDenom = Math.random().toString();
                const collateralAmount = 150;
                const collateral = {
                    type: RoverPosition_1.PositionType.COIN,
                    amount: collateralAmount,
                    closeFactor: 0.5,
                    denom: collateralDenom,
                    price: 2,
                    value: collateralAmount * 2,
                };
                const debt = {
                    amount: debtToRepay,
                    denom: debtDenom,
                    price: 1,
                };
                const market = (0, helpers_1.generateRandomMarket)(debtDenom);
                market.available_liquidity = debtToRepay * 1000;
                markets.push(market);
                const borrowActions = liquidationActionGenerator.produceBorrowActions(debt, collateral, markets, [debt.denom, collateral.denom], [(0, helpers_1.generateRandomCreditLine)(debt.denom), (0, helpers_1.generateRandomCreditLine)(collateral.denom)], [(0, helpers_1.generateRandomCreditLineCap)(debt.denom), (0, helpers_1.generateRandomCreditLineCap)(collateral.denom)]);
                console.log(borrowActions);
                const borrowAction = borrowActions[0];
                expect(borrowActions.length).toBe(1);
                expect(borrowAction.borrow.amount).toBe((150).toFixed(0));
                expect(borrowAction.borrow.denom).toBe(debtDenom);
            });
        });
        describe('Indirect Borrow', () => {
            test('Debt asset unavailable', () => {
                const markets = [];
                const liquidationActionGenerator = new LiquidationActionGenerator_1.LiquidationActionGenerator(router);
                const debtToRepay = 200;
                const collateralAmount = 500;
                const collateral = {
                    type: RoverPosition_1.PositionType.COIN,
                    amount: collateralAmount,
                    closeFactor: 0.5,
                    denom: collateralDenom,
                    price: 1.5,
                    value: 1.5 * collateralAmount,
                };
                const debt = {
                    amount: debtToRepay,
                    denom: debtDenom,
                    price: 1,
                };
                const market = (0, helpers_1.generateRandomMarket)(otherDenom);
                market.available_liquidity = debtToRepay * 1000;
                markets.push(market);
                const borrowActions = liquidationActionGenerator.produceBorrowActions(debt, collateral, markets, [market.denom, debt.denom, collateral.denom], [(0, helpers_1.generateRandomCreditLine)(debt.denom), (0, helpers_1.generateRandomCreditLine)(collateral.denom)], [(0, helpers_1.generateRandomCreditLineCap)(debt.denom), (0, helpers_1.generateRandomCreditLineCap)(collateral.denom)]);
                const borrowAction = borrowActions[0];
                const swapAction = borrowActions[1];
                expect(borrowActions.length).toBe(2);
                expect(Number(borrowAction.borrow.amount)).toBeGreaterThan(debtToRepay / debtToRandomAssetPrice);
                expect(swapAction.swap_exact_in.denom_out).toBe(debtDenom);
                expect(borrowAction.borrow.denom).toBe(otherDenom);
            });
            test('Debt available but < 50% required liquidity', () => {
                const markets = [];
                const liquidationActionGenerator = new LiquidationActionGenerator_1.LiquidationActionGenerator(router);
                const debtToRepay = 200;
                const collateralDenom = Math.random().toString();
                const collateralAmount = 500;
                const collateral = {
                    type: RoverPosition_1.PositionType.COIN,
                    amount: collateralAmount,
                    closeFactor: 0.5,
                    denom: collateralDenom,
                    price: 1.5,
                    value: collateralAmount * 1.5,
                };
                const debt = {
                    amount: debtToRepay,
                    denom: debtDenom,
                    price: 1,
                };
                const market = (0, helpers_1.generateRandomMarket)(debtDenom);
                market.available_liquidity = debtToRepay / 2.1;
                markets.push(market);
                const market2 = (0, helpers_1.generateRandomMarket)(otherDenom);
                market2.available_liquidity = debtToRepay;
                markets.push(market2);
                const borrowActions = liquidationActionGenerator.produceBorrowActions(debt, collateral, markets, [debt.denom, market.denom, market2.denom], [(0, helpers_1.generateRandomCreditLine)(debt.denom), (0, helpers_1.generateRandomCreditLine)(collateral.denom)], [(0, helpers_1.generateRandomCreditLineCap)(debt.denom), (0, helpers_1.generateRandomCreditLineCap)(collateral.denom)]);
                console.log(borrowActions);
                const borrowAction = borrowActions[0];
                expect(borrowActions.length).toBe(2);
                expect(borrowAction.borrow.denom).toBe(otherDenom);
            });
            test('If no swap route possible for borrow we throw error', () => {
                const markets = [];
                const liquidationActionGenerator = new LiquidationActionGenerator_1.LiquidationActionGenerator(router);
                const debtToRepay = 200;
                const collateralAmount = 500;
                const collateral = {
                    type: RoverPosition_1.PositionType.COIN,
                    amount: collateralAmount,
                    closeFactor: 0.5,
                    denom: 'does not exist',
                    price: 1.5,
                    value: collateralAmount * 1.5,
                };
                const debt = {
                    amount: debtToRepay,
                    denom: 'doesnotexist',
                    price: 1,
                };
                expect(() => {
                    liquidationActionGenerator.produceBorrowActions(debt, collateral, markets, [debtDenom], [(0, helpers_1.generateRandomCreditLine)(debt.denom), (0, helpers_1.generateRandomCreditLine)(collateral.denom)], [
                        (0, helpers_1.generateRandomCreditLineCap)(debt.denom),
                        (0, helpers_1.generateRandomCreditLineCap)(collateral.denom),
                    ]);
                }).toThrow(errors_1.NO_ROUTE_FOR_SWAP);
            });
        });
    });
});
//# sourceMappingURL=LiquidationActionGenerator.test.js.map