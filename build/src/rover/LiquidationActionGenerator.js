"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidationActionGenerator = void 0;
const RoverPosition_1 = require("./types/RoverPosition");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const errors_js_1 = require("./constants/errors.js");
const constants_1 = require("../constants");
const helpers_1 = require("../helpers");
const Pool_1 = require("../types/Pool");
class LiquidationActionGenerator {
    constructor(osmosisRouter) {
        this.setSwapperRoutes = (swapperRoutes) => {
            this.swapperRoutes = swapperRoutes;
        };
        this.produceBorrowActions = (debt, collateral, markets, whitelistedAssets, creditLines, creditLineCaps) => {
            const maxRepayValue = collateral.value * collateral.closeFactor;
            const maxDebtValue = debt.amount * debt.price;
            const debtToRepayRatio = maxDebtValue <= maxRepayValue ? 1 : maxRepayValue / maxDebtValue;
            let debtAmount = debt.amount * debtToRepayRatio;
            const debtCoin = {
                amount: debtAmount.toFixed(0),
                denom: debt.denom,
            };
            const marketInfo = markets.find((market) => market.denom === debt.denom);
            const creditLine = creditLines.find((creditLine) => creditLine.uncollateralized && debt.denom === creditLine.denom);
            const creditLineCap = creditLineCaps.find((creditLineCap) => creditLineCap.denom == debt.denom);
            const remainingCreditLine = creditLineCap && creditLine
                ? (0, bignumber_js_1.default)(creditLineCap.limit).minus(creditLine.amount)
                : new bignumber_js_1.default(0);
            if (!marketInfo ||
                !whitelistedAssets.find((denom) => denom === debt.denom) ||
                remainingCreditLine.dividedBy(2).isLessThan(debtAmount) ||
                marketInfo.available_liquidity / debtAmount < 0.5) {
                return this.borrowWithoutLiquidity(debtCoin, markets, whitelistedAssets);
            }
            if (marketInfo.available_liquidity / debtAmount < 1) {
                debtCoin.amount = (marketInfo.available_liquidity * constants_1.GENERIC_BUFFER).toFixed(0);
            }
            return [this.produceBorrowAction(debtCoin)];
        };
        this.borrowWithoutLiquidity = (debtCoin, markets, whitelistedAssets) => {
            const debtAmount = new bignumber_js_1.default(debtCoin.amount);
            const debtdenom = debtCoin.denom;
            const bestMarket = markets
                .filter((market) => market.denom !== debtdenom &&
                whitelistedAssets.find((denom) => market.denom === denom))
                .sort((marketA, marketB) => {
                const marketARoute = this.router.getBestRouteGivenOutput(marketA.denom, debtCoin.denom, debtAmount);
                const marketBRoute = this.router.getBestRouteGivenOutput(marketB.denom, debtCoin.denom, debtAmount);
                const marketADenomInput = this.router.getRequiredInput(debtAmount, marketARoute);
                const marketBDenomInput = this.router.getRequiredInput(debtAmount, marketBRoute);
                const marketALiquiditySufficient = marketADenomInput.toNumber() < marketA.available_liquidity * constants_1.GENERIC_BUFFER;
                const marketBLiquiditySufficient = marketBDenomInput.toNumber() < marketB.available_liquidity * constants_1.GENERIC_BUFFER;
                if (!marketALiquiditySufficient && !marketBLiquiditySufficient) {
                    return (marketA.available_liquidity / marketADenomInput.toNumber() -
                        marketB.available_liquidity / marketBDenomInput.toNumber());
                }
                if (marketALiquiditySufficient && !marketBLiquiditySufficient) {
                    return 1;
                }
                if (!marketALiquiditySufficient && marketBLiquiditySufficient) {
                    return -1;
                }
                return marketADenomInput.minus(marketBDenomInput).toNumber();
            })
                .pop();
            if (!bestMarket)
                throw new Error(errors_js_1.NO_VALID_MARKET);
            const bestRoute = this.router.getBestRouteGivenOutput(bestMarket.denom, debtdenom, debtAmount);
            if (bestRoute.length === 0)
                throw new Error(errors_js_1.NO_ROUTE_FOR_SWAP);
            const inputRequired = this.router.getRequiredInput(debtAmount, bestRoute);
            const safeBorrow = inputRequired.toNumber() > bestMarket.available_liquidity
                ? new bignumber_js_1.default(bestMarket.available_liquidity * constants_1.GENERIC_BUFFER)
                : inputRequired;
            const actions = [];
            const borrow = this.produceBorrowAction({
                amount: safeBorrow.toFixed(0),
                denom: bestMarket.denom,
            });
            actions.push(borrow);
            bestRoute.forEach((hop) => {
                const action = this.produceSwapAction(hop.tokenInDenom, hop.tokenOutDenom);
                actions.push(action);
            });
            return actions;
        };
        this.getAvailablePools = () => {
            const pools = [];
            this.swapperRoutes.forEach((route) => {
                route.route.forEach((hop) => {
                    if (pools.find((pool) => pool === hop.pool_id) === undefined) {
                        pools.push(hop.pool_id);
                    }
                });
            });
            return pools;
        };
        this.isViableRoute = (route) => {
            return (route.filter((hop) => this.swapperRoutes.find((swapperRoute) => (swapperRoute.denom_in === hop.tokenInDenom &&
                swapperRoute.denom_out === hop.tokenOutDenom) ||
                (swapperRoute.denom_in === hop.tokenOutDenom &&
                    swapperRoute.denom_out === hop.tokenInDenom)) !== undefined).length > 0);
        };
        this.generateSwapActions = (assetInDenom, assetOutDenom, outAmount) => {
            const bnOut = new bignumber_js_1.default(outAmount);
            const swapperPools = this.getAvailablePools();
            const usablePools = this.router.getPools().filter((pool) => swapperPools.indexOf(pool.id.toString()) !== -1);
            this.router.setPools(usablePools);
            const routes = this.router.getRoutes(assetInDenom, assetOutDenom);
            const enabledRoutes = routes.filter((route) => this.isViableRoute(route));
            const route = this.router.getRouteWithLowestInput(bnOut, enabledRoutes);
            if (route.length === 0)
                throw new Error(errors_js_1.NO_ROUTE_FOR_SWAP);
            return route.map((hop) => this.produceSwapAction(hop.tokenInDenom, hop.tokenOutDenom, process.env.SLIPPAGE_LIMIT));
        };
        this.produceRefundAllAction = () => {
            return {
                refund_all_coin_balances: {},
            };
        };
        this.produceLiquidationAction = (positionType, debtCoin, liquidateeAccountId, requestCoinDenom, vaultPositionType) => {
            return positionType === RoverPosition_1.PositionType.COIN
                ? this.produceLiquidateCoin(debtCoin, liquidateeAccountId, requestCoinDenom)
                : this.produceLiquidateVault(debtCoin, liquidateeAccountId, vaultPositionType, {
                    address: requestCoinDenom,
                });
        };
        this.produceVaultToDebtActions = (vault, borrowDenom) => {
            let vaultActions = [];
            if (!vault)
                throw new Error(errors_js_1.UNSUPPORTED_VAULT);
            const lpTokenDenom = vault.baseToken;
            const poolId = lpTokenDenom.split('/').pop();
            const withdraw = this.produceWithdrawLiquidityAction(lpTokenDenom);
            vaultActions.push(withdraw);
            const pool = this.router.getPool(poolId);
            if (!pool)
                throw new Error(`${errors_js_1.POOL_NOT_FOUND} : ${poolId}`);
            if (pool.poolType === Pool_1.PoolType.CONCENTRATED_LIQUIDITY || pool.poolType === Pool_1.PoolType.STABLESWAP) {
                return [];
            }
            pool.poolAssets
                .filter((poolAsset) => poolAsset.token.denom !== borrowDenom)
                .forEach((poolAsset) => (vaultActions = vaultActions.concat(this.generateSwapActions(poolAsset.token.denom, borrowDenom, '1'))));
            return vaultActions;
        };
        this.produceWithdrawLiquidityAction = (lpTokenDenom) => {
            return {
                withdraw_liquidity: {
                    lp_token: {
                        amount: 'account_balance',
                        denom: lpTokenDenom,
                    },
                },
            };
        };
        this.generateRepayActions = (debtDenom) => {
            const actions = [];
            actions.push(this.produceRepayAction(debtDenom));
            return actions;
        };
        this.convertCollateralToDebt = (collateralDenom, borrow, vault) => {
            return vault !== undefined
                ? this.produceVaultToDebtActions(vault, borrow.denom)
                : this.swapCollateralCoinToBorrowActions(collateralDenom, borrow);
        };
        this.swapCollateralCoinToBorrowActions = (collateralDenom, borrowed) => {
            let actions = [];
            if (collateralDenom.startsWith('gamm/')) {
                actions.push(this.produceWithdrawLiquidityAction(collateralDenom));
                const underlyingDenoms = (0, helpers_1.findUnderlying)(collateralDenom, this.router.getPools());
                underlyingDenoms?.forEach((denom) => {
                    if (denom !== borrowed.denom) {
                        actions = actions.concat(this.generateSwapActions(denom, borrowed.denom, borrowed.amount));
                    }
                });
            }
            else {
                actions = actions.concat(this.generateSwapActions(collateralDenom, borrowed.denom, borrowed.amount));
            }
            return actions;
        };
        this.produceLiquidateCoin = (debtCoin, liquidateeAccountId, requestCoinDenom) => {
            return {
                liquidate_coin: {
                    debt_coin: debtCoin,
                    liquidatee_account_id: liquidateeAccountId,
                    request_coin_denom: requestCoinDenom,
                },
            };
        };
        this.produceLiquidateVault = (debtCoin, liquidateeAccountId, vaultPositionType, requestVault) => {
            return {
                liquidate_vault: {
                    debt_coin: debtCoin,
                    liquidatee_account_id: liquidateeAccountId,
                    position_type: vaultPositionType,
                    request_vault: requestVault,
                },
            };
        };
        this.produceRepayAction = (denom) => {
            return {
                repay: {
                    amount: 'account_balance',
                    denom: denom,
                },
            };
        };
        this.produceSwapAction = (denomIn, denomOut, slippage = '0.005') => {
            return {
                swap_exact_in: {
                    coin_in: { denom: denomIn, amount: 'account_balance' },
                    denom_out: denomOut,
                    slippage: slippage,
                },
            };
        };
        this.produceBorrowAction = (debtCoin) => {
            const borrow = {
                borrow: debtCoin,
            };
            return borrow;
        };
        this.router = osmosisRouter;
        this.swapperRoutes = [];
    }
}
exports.LiquidationActionGenerator = LiquidationActionGenerator;
//# sourceMappingURL=LiquidationActionGenerator.js.map