"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionGenerator = void 0;
const RoverPosition_js_1 = require("./types/RoverPosition.js");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const errors_js_1 = require("./constants/errors.js");
const constants_js_1 = require("../constants.js");
const helpers_js_1 = require("../helpers.js");
const Pool_js_1 = require("../types/Pool.js");
const sidecar_js_1 = require("../query/sidecar.js");
class ActionGenerator {
    constructor(osmosisRouter) {
        this.produceBorrowActions = (debt, collateral, markets, whitelistedAssets, creditLines, creditLineCaps) => {
            if (false)
                console.log(creditLines, creditLineCaps);
            let maxRepayValue = (collateral.value * collateral.closeFactor);
            const maxDebtValue = debt.amount * debt.price;
            const debtCeiling = 10000000000;
            if (maxDebtValue > debtCeiling) {
                maxRepayValue = debtCeiling;
            }
            const debtToRepayRatio = maxDebtValue <= maxRepayValue ? 1 : maxRepayValue / maxDebtValue;
            let debtAmount = debt.amount * debtToRepayRatio;
            const debtCoin = {
                amount: debtAmount.toFixed(0),
                denom: debt.denom,
            };
            const marketInfo = markets.find((market) => market.denom === debt.denom);
            if (!marketInfo ||
                marketInfo.available_liquidity / debtAmount < 0.5) {
                return this.borrowWithoutLiquidity(debtCoin, markets, whitelistedAssets);
            }
            if (marketInfo.available_liquidity / debtAmount < 1) {
                debtCoin.amount = (marketInfo.available_liquidity * constants_js_1.GENERIC_BUFFER).toFixed(0);
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
                const marketALiquiditySufficient = marketADenomInput.toNumber() < marketA.available_liquidity * constants_js_1.GENERIC_BUFFER;
                const marketBLiquiditySufficient = marketBDenomInput.toNumber() < marketB.available_liquidity * constants_js_1.GENERIC_BUFFER;
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
                throw new Error(`${errors_js_1.NO_ROUTE_FOR_SWAP}. ${bestMarket.denom} -> ${debtdenom}`);
            const inputRequired = this.router.getRequiredInput(debtAmount, bestRoute);
            const safeBorrow = inputRequired.toNumber() > bestMarket.available_liquidity
                ? new bignumber_js_1.default(bestMarket.available_liquidity * constants_js_1.GENERIC_BUFFER)
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
        this.generateSwapActions = async (assetInDenom, assetOutDenom, amount, slippage) => {
            let sqsRoute = await (0, sidecar_js_1.getRoute)('https://sqs.osmosis.zone/', amount, assetInDenom, assetOutDenom);
            let swapper_route = {
                osmo: (0, helpers_js_1.createOsmoRoute)(sqsRoute)
            };
            return this.produceSwapAction(assetInDenom, assetOutDenom, slippage, swapper_route);
        };
        this.produceRefundAllAction = () => {
            return {
                refund_all_coin_balances: {},
            };
        };
        this.produceLiquidationAction = (positionType, debtCoin, liquidateeAccountId, requestCoinDenom, vaultPositionType) => {
            return positionType === RoverPosition_js_1.PositionType.VAULT
                ? this.produceLiquidateVault(debtCoin, liquidateeAccountId, vaultPositionType, {
                    address: requestCoinDenom,
                })
                : this.produceLiquidateCoin(debtCoin, liquidateeAccountId, requestCoinDenom, positionType === RoverPosition_js_1.PositionType.DEPOSIT);
        };
        this.produceVaultToDebtActions = async (vault, borrow, slippage, prices) => {
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
            if (pool.poolType === Pool_js_1.PoolType.CONCENTRATED_LIQUIDITY || pool.poolType === Pool_js_1.PoolType.STABLESWAP) {
                return [];
            }
            let filteredPools = pool.poolAssets
                .filter((poolAsset) => poolAsset.token.denom !== borrow.denom);
            for (const poolAsset of filteredPools) {
                const asset_out_price = prices.get(borrow.denom) || 0;
                const asset_in_price = prices.get(poolAsset.token.denom) || 0;
                const amount_in = new bignumber_js_1.default(asset_out_price / asset_in_price)
                    .multipliedBy(borrow.amount);
                (vaultActions.push(await this.generateSwapActions(poolAsset.token.denom, borrow.denom, amount_in.toFixed(0), slippage)));
            }
            return vaultActions;
        };
        this.produceWithdrawLiquidityAction = (lpTokenDenom) => {
            return {
                withdraw_liquidity: {
                    lp_token: {
                        amount: 'account_balance',
                        denom: lpTokenDenom,
                    },
                    slippage: '0.01',
                },
            };
        };
        this.generateRepayActions = (debtDenom) => {
            const actions = [];
            actions.push(this.produceRepayAction(debtDenom));
            return actions;
        };
        this.convertCollateralToDebt = async (collateralDenom, borrow, vault, slippage, prices) => {
            return vault !== undefined
                ? await this.produceVaultToDebtActions(vault, borrow, slippage, prices)
                : await this.swapCollateralCoinToBorrowActions(collateralDenom, borrow, slippage, prices);
        };
        this.swapCollateralCoinToBorrowActions = async (collateralDenom, borrowed, slippage, prices) => {
            let actions = [];
            if (collateralDenom.startsWith('gamm/')) {
                actions.push(this.produceWithdrawLiquidityAction(collateralDenom));
                const underlyingDenoms = (0, helpers_js_1.findUnderlying)(collateralDenom, this.router.getPools());
                for (const denom of underlyingDenoms) {
                    if (denom !== borrowed.denom) {
                        const asset_out_price = prices.get(borrowed.denom) || 0;
                        const asset_in_price = prices.get(collateralDenom) || 0;
                        const amount_in = new bignumber_js_1.default(asset_out_price / asset_in_price).multipliedBy(Number(borrowed.amount));
                        console.log(amount_in.toFixed(0));
                        actions = actions.concat(await this.generateSwapActions(denom, borrowed.denom, amount_in.toFixed(0), slippage));
                    }
                }
            }
            else {
                const asset_out_price = prices.get(borrowed.denom) || 0;
                const asset_in_price = prices.get(collateralDenom) || 0;
                const amount_in = new bignumber_js_1.default(asset_out_price / asset_in_price).multipliedBy(Number(borrowed.amount));
                actions = actions.concat(await this.generateSwapActions(collateralDenom, borrowed.denom, amount_in.toFixed(0), slippage));
            }
            return actions;
        };
        this.produceLiquidateCoin = (debtCoin, liquidateeAccountId, requestCoinDenom, isDeposit) => {
            return {
                liquidate: {
                    debt_coin: debtCoin,
                    liquidatee_account_id: liquidateeAccountId,
                    request: isDeposit ? { deposit: requestCoinDenom } : { lend: requestCoinDenom }
                }
            };
        };
        this.produceLiquidateVault = (debtCoin, liquidateeAccountId, vaultPositionType, requestVault) => {
            return {
                liquidate: {
                    debt_coin: debtCoin,
                    liquidatee_account_id: liquidateeAccountId,
                    request: {
                        vault: {
                            position_type: vaultPositionType,
                            request_vault: requestVault
                        }
                    }
                },
            };
        };
        this.produceRepayAction = (denom) => {
            return {
                repay: {
                    coin: {
                        amount: 'account_balance',
                        denom: denom,
                    }
                },
            };
        };
        this.produceSwapAction = (denomIn, denomOut, slippage = '0.005', route = null) => {
            return {
                swap_exact_in: {
                    coin_in: { denom: denomIn, amount: 'account_balance' },
                    denom_out: denomOut,
                    slippage: slippage,
                    route: route,
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
    }
}
exports.ActionGenerator = ActionGenerator;
//# sourceMappingURL=ActionGenerator.js.map