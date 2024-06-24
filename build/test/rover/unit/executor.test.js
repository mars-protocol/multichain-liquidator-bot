"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RoverExecutor_1 = require("../../../src/rover/RoverExecutor");
describe('Rover Executor Tests', () => {
    test('Can find largest collateral when it is an unlocking position', () => {
        const collateral1 = {
            amount: '500',
            denom: 'testcoin1',
        };
        const collateral2 = {
            amount: {
                unlocked: '400',
            },
            vault: {
                address: 'vault1',
            },
        };
        const unlocking1 = {
            coin: {
                denom: 'coin1',
                amount: '100',
            },
            id: 0,
        };
        const unlocking2 = {
            coin: {
                denom: 'coin1',
                amount: '600',
            },
            id: 0,
        };
        const collateral3 = {
            amount: {
                locking: {
                    locked: '100',
                    unlocking: [unlocking1, unlocking2],
                },
            },
            vault: {
                address: 'vault1',
            },
        };
        const executor = new RoverExecutor_1.RoverExecutor({}, {}, {});
        const collateralState = executor.findBestCollateral([collateral1], [collateral2, collateral3]);
        expect(collateralState.amount).toBe(600);
    }),
        test('Can find largest collateral when it is an unlocked position', () => {
            const collateral1 = {
                amount: '500',
                denom: 'testcoin1',
            };
            const collateral2 = {
                amount: {
                    unlocked: '800',
                },
                vault: {
                    address: 'vault1',
                },
            };
            const unlocking1 = {
                coin: {
                    denom: 'coin1',
                    amount: '100',
                },
                id: 0,
            };
            const unlocking2 = {
                coin: {
                    denom: 'coin1',
                    amount: '300',
                },
                id: 0,
            };
            const collateral3 = {
                amount: {
                    locking: {
                        locked: '100',
                        unlocking: [unlocking1, unlocking2],
                    },
                },
                vault: {
                    address: 'vault1',
                },
            };
            const executor = new RoverExecutor_1.RoverExecutor({}, {}, {});
            const collateralState = executor.findBestCollateral([collateral1], [collateral2, collateral3]);
            expect(collateralState.amount).toBe(800);
        });
    test('Can find largest collateral when it is a coin', () => {
        const collateral1 = {
            amount: '1500',
            denom: 'testcoin1',
        };
        const collateral2 = {
            amount: {
                unlocked: '800',
            },
            vault: {
                address: 'vault1',
            },
        };
        const unlocking1 = {
            coin: {
                denom: 'coin1',
                amount: '100',
            },
            id: 0,
        };
        const unlocking2 = {
            coin: {
                denom: 'coin1',
                amount: '300',
            },
            id: 0,
        };
        const collateral3 = {
            amount: {
                locking: {
                    locked: '100',
                    unlocking: [unlocking1, unlocking2],
                },
            },
            vault: {
                address: 'vault1',
            },
        };
        const executor = new RoverExecutor_1.RoverExecutor({}, {}, {});
        const collateralState = executor.findBestCollateral([collateral1], [collateral2, collateral3]);
        expect(collateralState.amount).toBe(1500);
    });
    test('Can find largest debt', () => {
        const debt1 = {
            amount: '1500',
            denom: 'testcoin1',
        };
        const debt2 = {
            amount: '1500',
            denom: 'testcoin1',
        };
        const executor = new RoverExecutor_1.RoverExecutor({}, {}, {});
        const bestDebt = executor.findBestDebt([debt1, debt2]);
        expect(bestDebt.amount).toBe(1500);
    });
});
//# sourceMappingURL=executor.test.js.map