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
        let debtAmount = debt.amount * debtToRepayRatio
        
        const debtCoin : Coin = {
            amount : debtAmount.toFixed(0),
            denom: debt.denom
        }
        
        // if asset is not enabled, or we have less than 50% the required liquidity, do alternative borrow       
        const marketInfo : MarketInfo | undefined = this.markets.find((market)=> market.denom === debt.denom)
        if (!marketInfo || !marketInfo.borrow_enabled || (marketInfo.available_liquidity / debtAmount) < 0.5) {
            return this.borrowWithoutLiquidity(debtCoin)
        }

        // if we have some liquidity but not enough, scale down
        if ((marketInfo.available_liquidity / debtAmount) < 1) {
            debtCoin.amount = (marketInfo.available_liquidity * 0.99).toFixed(0)
        }
       
        return [ this.produceBorrowAction(debtCoin) ]
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

        // filter out disabled markets + our debt denom to avoid corrupted swap messages
        // sort the markets by best -> worst swap in terms of redbank liqudity and cost, and return the best.
        const bestMarket = this.markets.filter((market) =>  market.borrow_enabled && market.denom !== debtdenom).sort(
            (marketA, marketB) => {
                // find best routes for each market we are comparing. Best meaning cheapest input amount to get our required output 
                const marketARoute = this.router.getBestRouteGivenOutput(marketA.denom, debtCoin.denom, debtAmount)
                const marketBRoute = this.router.getBestRouteGivenOutput(marketB.denom, debtCoin.denom, debtAmount)

                const marketADenomInput = this.router.getRequiredInput(debtAmount, marketARoute)
                const marketBDenomInput = this.router.getRequiredInput(debtAmount, marketBRoute)
                
                // params to represent sufficient liquidity (99% is a buffer for interest rates etc)
                const marketALiquiditySufficient = marketADenomInput.toNumber() < marketA.available_liquidity * 0.99
                const marketBLiquiditySufficient = marketBDenomInput.toNumber() < marketB.available_liquidity * 0.99

                // if neither market has liqudity, return which one has the larger share
                if (!marketALiquiditySufficient && !marketBLiquiditySufficient) {
                    return (marketA.available_liquidity / marketADenomInput.toNumber()) - (marketB.available_liquidity / marketBDenomInput.toNumber())
                }

                // if market b does not have liqudity, prioritise a
                if (marketALiquiditySufficient && !marketBLiquiditySufficient) {
                    return 1
                }

                // if market a does not have liqudity, prioritise b
                if (!marketALiquiditySufficient && marketBLiquiditySufficient) {
                    return -1
                }

                // if both have liqudity, return that with the cheapest swap
                return marketADenomInput.minus(marketBDenomInput).toNumber()
            }
            ).pop()

        if (!bestMarket) throw new Error(NO_VALID_MARKET)

        const bestRoute = this.router.getBestRouteGivenOutput(bestMarket.denom, debtdenom, debtAmount)

        if (bestRoute.length ===0) throw new Error(NO_ROUTE_FOR_SWAP)

        const inputRequired = this.router.getRequiredInput(debtAmount, bestRoute)

        // cap borrow to be under market liquidity
        const safeBorrow = inputRequired.toNumber() > bestMarket.available_liquidity 
            ? new BigNumber(bestMarket.available_liquidity*0.99)
            : inputRequired

        const actions : Action[] = []

        const borrow: Action = this.produceBorrowAction({
            amount: safeBorrow.toFixed(0),
            denom: bestMarket.denom
        })

        actions.push(borrow)

        // Create swap message(s). Note that we are not passing in the swap amount, which means that 
        // the credit manager will swap everything that we have for that asset inside of our 
        // credit manager sub account. To minimise slippage, should ensure that we do not keep
        // additional funds inside the subaccount we are using for liquidations
        bestRoute.forEach((hop: RouteHop) => {
            const action = this.produceSwapAction(hop.tokenInDenom, hop.tokenOutDenom)

            actions.push(action)
        })

        return actions
    }

    /**
     * Swap the coillateral we won to repay the debt we borrowed. This method calculates the
     * best route and returns an array of swap actions (on action per route hop) to execute
     * the swap.
     * For instance, if there is no direct pool between the collateral won and the debt borrowed,
     * we will need to use an intermediary pool or even multiple pools to complete the swap.
     * 
     * @param collateralWonDenom
     * @param debtBorrowedDenom
     * @param debtAmount
     * @returns An array of swap actions that convert the asset from collateral to the debt.
     */
    generateSwapActions = (collateralWonDenom: string, debtBorrowedDenom: string, debtAmount: string) : Action[] => {

        const route = this.router.getBestRouteGivenOutput(collateralWonDenom, debtBorrowedDenom, new BigNumber(debtAmount))

        if (route.length === 0) throw new Error(NO_ROUTE_FOR_SWAP)

        return route.map((hop: RouteHop) => this.produceSwapAction(hop.tokenInDenom, hop.tokenOutDenom, process.env.SLIPPAGE_LIMIT) )
    }

    produceSwapAction = (denomIn: string, denomOut : string, slippage : string = "0.005") : Action => {
        return {
            swap_exact_in: {
                denom_out: denomOut,
                slippage: slippage
            }
        }
    }

    /**
     * Construct a simple borrow action. 
     * @param debtCoin The coin we want to borrow
     * @returns A borrow action
     */
    private produceBorrowAction = (debtCoin : Coin) : Action => {
        const borrow: Action = {
            borrow : debtCoin
        }

        return  borrow 
    }
}