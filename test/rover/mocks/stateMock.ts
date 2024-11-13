import { Coin, Positions } from "marsjs-types/mars-credit-manager/MarsCreditManager.types";
import { MarketInfo } from "../../../src/rover/types/MarketInfo";
import BigNumber from "bignumber.js";
import { InterestRateModel } from "marsjs-types/mars-red-bank/MarsRedBank.types";

export class StateMock {
    constructor(
        public account: Positions,
        public markets: Map<string, MarketInfo>,
        public prices: Map<string, BigNumber>
    ){}

    public setUserDeposits(deposits: Coin[]): void {
        this.account.deposits = deposits
    }

    public setUserDebts(debts: Coin[]): void {
        this.account.debts = debts.map(debt => {return { ...debt, shares: '0' }});
    }

    public static default(): StateMock {

        return new StateMock(
            {
                account_id: '1',
                account_kind: 'default',
                debts: [],
                deposits: [],
                lends: [],
                staked_astro_lps: [],
                vaults: [],
                perps: [],
            },
            new Map<string, MarketInfo>(
                [
                    [
                        'uusd', 
                        { ...defaultMarket, denom: 'uusd'}
                    ],
                    [
                        'atom',
                        { ...defaultMarket, denom: 'uatom'}
                    ]

            ]
            ),
            new Map<string, BigNumber>(
                [
                    ['uusd', new BigNumber(1)],
                    ['uatom', new BigNumber(10)]
                ]
            )
        )
    }
} 



const defaultMarket: MarketInfo = {
    available_liquidity: new BigNumber(0),
    borrow_index: '0',
    borrow_rate: '0',
    collateral_total_scaled: '0',
    collateral_total_amount: '0',
    debt_total_amount: '0',
    debt_total_scaled: '0',
    denom: 'uusd',
    indexes_last_updated: 0,
    interest_rate_model: {} as InterestRateModel,
    liquidity_index: '0',
    liquidity_rate: '0',
    reserve_factor: '0',
    utilization_rate: '0',
}