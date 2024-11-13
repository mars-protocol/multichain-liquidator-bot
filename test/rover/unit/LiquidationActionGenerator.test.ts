import { Action, Coin } from "marsjs-types/mars-credit-manager/MarsCreditManager.types";
import { RouteRequester } from "../../../src/query/routing/RouteRequesterInterface";
import { ActionGenerator } from "../../../src/rover/ActionGenerator";
import { StateMock } from "../mocks/stateMock";
import Long from "long";
import { Pool } from "../../../src/types/Pool";

describe(('Liquidation Action Generator Tests'), () => {

    let mock = StateMock.default()

    const mockRouteRequester: jest.Mocked<RouteRequester> = {
        requestRoute: jest.fn(),
        apiUrl: 'http://localhost:8080',
    };

    const liquidationActionGenerator = new ActionGenerator(mockRouteRequester)

    describe(('uusd collateral; atom debt'), () => {
        let actions: Action[] = []
        beforeAll(async () => {
            mock.setUserDeposits([
                {
                    denom: 'uusd',
                    amount: '1000',
                },
            ])

            mock.setUserDebts([
                {
                    denom: 'uatom',
                    amount: '80',
                }
            ])

            mockRouteRequester.requestRoute.mockResolvedValue({
                route: [
                        {
                            poolId: Long.fromNumber(1),
                            tokenInDenom: 'uusd',
                            tokenOutDenom: 'uatom',
                            pool: {} as Pool
                        }
                ],
                expectedOutput: '100'
            });

            actions = await liquidationActionGenerator.generateLiquidationActions(
                mock.account,
                mock.prices,
                mock.markets
            )
        })

        it('Should borrow atom', () => {
            // @ts-ignore
            let amount : String = actions[0].borrow.amount
            // @ts-ignore
            let denom : String = actions[0].borrow.denom

            expect(amount).toBe('80')
            expect(denom).toBe('uatom')
        })
        it('Should select deposit usd collateral', () => {
            console.log(actions[1])
            // @ts-ignore
            let denom : String = actions[1].liquidate.request.deposit
           
            expect(denom).toBe('uusd')
        });
        it('Should select atom debt to repay', () => {
            //@ts-ignore
            let debtCoin : Coin = actions[1].liquidate.debt_coin

            expect(debtCoin.denom).toBe('uatom')
            expect(debtCoin.amount).toBe('80')
        });

        it('Should swap all won usd collateral to atom', () => {
            console.log(actions[2])
        })

        it('Should repay atom', () => {
            console.log(actions[3])

        })

        it('Should swap atom to usd', () => {
            console.log(actions[4])

        })
    });
    // Single collateral, multiple debts
    describe(('uusd collateral; usd debt(smaller), atom debt(larger)'), () => {
        it('Should borrow atom', () => {
            
        })
        it('Should pick the usd collateral', () => {
        
        });
        it('Should pick the atom debt to repay', () => {
        
        });

        it('Should swap all won usd collateral to atom', () => {
            
        })

        it('Should repay atom', () => {
            
        })

        it('Should swap atom to usd', () => {
            
        })
    });

    describe(('uusd collateral; usd debt(larger), atom debt(smaller),'), () => {
        it('Should borrow usd', () => {
            
        })
        it('Should pick the usd collateral', () => {
        
        });
        it('Should pick the usd debt to repay', () => {
        
        });

        it('Should not do any swap of the collateral', () => {
            
        })

        it('Should repay usd', () => {
            
        })
    });



})
