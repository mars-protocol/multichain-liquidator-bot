import { AMMRouter} from "../amm_router";
import { MarketInfo } from "./types/MarketInfo";
import { Collateral, Debt } from "./types/RoverPosition";
import { Action, Coin } from "@marsjs-types/creditmanager/mars-credit-manager/MarsCreditManager.types"
import BigNumber from "bignumber.js";
import { RouteHop } from "../types/RouteHop";
import { NO_ROUTE_FOR_SWAP, NO_VALID_MARKET } from "./constants/Errors";

export class LiquidationActionGenerator {
    
    private router : AMMRouter
    private markets: MarketInfo[]

    constructor(
        osmosisRouter : AMMRouter,
        markets : MarketInfo[]
    ) {
        this.router = osmosisRouter
        this.markets = markets
    }

    /**
     * Produce the borrow actions.
     * 
     * The sunny day case is that we can borrow the exact amount from credit manager
     * with no issues, however there are edge cases that we need to handle, 
     * such as when borrows for that asset are disabled or the utilisation 
     * is 100%
     * 
     * To handle this case, we need to borrow a separate asset  
     * and sell that asset to the debt asset.  
     * 
     * @param debt The largest debt in the position
     * @param collateral The largest collateral in the position
     */
    produceBorrowActions = (debt: Debt, collateral: Collateral) : Action[] => {

        // estimate our debt to repay - this depends on collateral amount and close factor
        const maxRepayValue = collateral.amount * collateral.price * collateral.closeFactor
        const maxDebtValue = debt.amount * debt.price
        const debtToRepayRatio = maxDebtValue <= maxRepayValue ? 1 : maxRepayValue / maxDebtValue

        // debt amount is a number, not a value (e.g in dollar / base asset denominated terms)
        const debtAmount = debt.amount * debtToRepayRatio

        // check if we have the liquidity on mars to perform this borrow action        
        const marketInfo : MarketInfo | undefined = this.markets.find((market)=> market.denom === debt.denom)
        const hasLiquidity = marketInfo && marketInfo.borrow_enabled  && marketInfo.available_liquidity > debtAmount

        const debtCoin : Coin = {
            amount : debtAmount.toFixed(0),
            denom: debt.denom
        }

        return hasLiquidity ? [ this.produceBorrowAction(debtCoin) ] : this.borrowWithoutLiquidity(debtCoin)
    }

    /**
     * This method facilitates "borrowing" an asset that does not currently have liqudity in mars.
     * Examples where this can happen is where the required asset is disabled/removed from whitelist 
     * or utilsation is 100%.
     * 
     * This method provides the requested asset by borrowing a separate asset and swapping it to the 
     * requested asset. This will obviously incur fees + slippage so should only be used in emergencies.
     * 
     * @param debtCoin The debt that we are required to repay to perform the liquidation
     * @returns an array of actions that will update the state to have the requested coin.
     */
    borrowWithoutLiquidity = (debtCoin : Coin) : Action[] => {

        // Assign inner coin variables for ease of use, as we use many times
        const debtAmount = new BigNumber(debtCoin.amount)
        const debtdenom = debtCoin.denom

        // sort the markets by best -> worst swap in terms of cost, and return the best.
        const bestMarket = this.markets.sort(
            (marketA, marketB) => {

                // find best routes for each market we are comparing. Best meaning cheapest input amount to get our required output 
                const marketARoute = this.router.getBestRouteGivenOutput(marketA.denom, debtCoin.denom, debtAmount)
                const marketBRoute = this.router.getBestRouteGivenOutput(marketB.denom, debtCoin.denom, debtAmount)

                // return marketARequiredInput - marketBRequiredInput
                return this.router.getRequiredInput(
                    debtAmount, 
                    marketARoute).minus(
                        this.router.getRequiredInput(
                            debtAmount,
                            marketBRoute)).toNumber()
            }
            ).pop()

        if (!bestMarket) throw new Error(NO_VALID_MARKET)

        const bestRoute = this.router.getBestRouteGivenOutput(bestMarket.denom, debtdenom, debtAmount)

        if (bestRoute.length ===0) throw new Error(NO_ROUTE_FOR_SWAP)

        const inputRequired = this.router.getRequiredInput(debtAmount, bestRoute)

        const actions : Action[] = []

        const borrow: Action = this.produceBorrowAction({
            amount: inputRequired.toFixed(0),
            denom: bestMarket.denom
        })

        actions.push(borrow)

        // Create swap message(s). Note that we are not passing in the swap amount, which means that 
        // the credit manager will swap everything that we have for that asset inside of our 
        // credit manager sub account. To minimise slippage, should ensure 
        bestRoute.forEach((hop: RouteHop) => {
            const action : Action = {
                swap_exact_in: {
                    denom_out: hop.tokenOutDenom,
                    slippage: process.env.SWAP_SLIPPAGE_LIMIT || "0.05" // 0.05% slippage? 
                }
            }

            actions.push(action)
        })

        return actions
    }

    /**
     * Construct a simple borrow action. 
     * @param debtCoin The coin we want to borrow
     * @returns A borrow action
     */
    produceBorrowAction = (debtCoin : Coin) : Action => {
        const borrow: Action = {
            borrow : debtCoin
        }

        return  borrow 
    }
}