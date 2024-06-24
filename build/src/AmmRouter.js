"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMMRouter = void 0;
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const math_1 = require("./math");
const Pool_1 = require("./types/Pool");
const math_2 = require("@osmosis-labs/math");
const unit_1 = require("@keplr-wallet/unit");
class AMMRouter {
    constructor() {
        this.findUsedPools = (route) => {
            return route.map((hop) => hop.poolId);
        };
        this.pools = [];
    }
    setPools(pools) {
        this.pools = pools;
    }
    getPools() {
        return this.pools;
    }
    getPool(id) {
        return this.pools.find((pool) => pool.id.toString() === id);
    }
    getOutput(tokenInAmount, route) {
        let amountAfterFees = new bignumber_js_1.default(0);
        if (tokenInAmount.isEqualTo(0)) {
            console.log('ERROR - cannot use token in amount of 0');
            return amountAfterFees;
        }
        route.forEach((routeHop) => {
            const pool = routeHop.pool;
            switch (pool.poolType) {
                case Pool_1.PoolType.XYK:
                    const xykPool = pool;
                    const x1 = new bignumber_js_1.default(xykPool.poolAssets.find((poolAsset) => poolAsset.token.denom === routeHop.tokenInDenom)?.token.amount);
                    const y1 = new bignumber_js_1.default(xykPool.poolAssets.find((poolAsset) => poolAsset.token.denom === routeHop.tokenOutDenom)?.token.amount);
                    const amountBeforeFees = (0, math_1.calculateOutputXYKPool)(x1, y1, new bignumber_js_1.default(tokenInAmount));
                    amountAfterFees = amountBeforeFees.minus(amountBeforeFees.multipliedBy(routeHop.pool.swapFee));
                    tokenInAmount = amountAfterFees;
                    break;
                case Pool_1.PoolType.CONCENTRATED_LIQUIDITY:
                    const clPool = pool;
                    const tokenIn = {
                        denom: routeHop.tokenInDenom,
                        amount: new unit_1.Int(tokenInAmount.toFixed(0))
                    };
                    const tokenDenom0 = clPool.token0;
                    const poolLiquidity = new unit_1.Dec(clPool.currentTickLiquidity);
                    const inittedTicks = tokenIn.denom === tokenDenom0 ? clPool.liquidityDepths.zeroToOne : clPool.liquidityDepths.oneToZero;
                    const curSqrtPrice = new math_2.BigDec(clPool.currentSqrtPrice);
                    const swapFee = new unit_1.Dec(clPool.swapFee);
                    const result = math_2.ConcentratedLiquidityMath.calcOutGivenIn({
                        tokenIn,
                        tokenDenom0,
                        poolLiquidity,
                        inittedTicks,
                        curSqrtPrice,
                        swapFee,
                    });
                    if (result === "no-more-ticks") {
                        tokenInAmount = new bignumber_js_1.default(0);
                        break;
                    }
                    const { amountOut } = result;
                    tokenInAmount = new bignumber_js_1.default(amountOut.toString());
                    break;
            }
        });
        return amountAfterFees;
    }
    getRequiredInput(tokenOutRequired, route) {
        let amountAfterFees = new bignumber_js_1.default(0);
        if (tokenOutRequired.isEqualTo(0)) {
            console.log('ERROR - cannot use token out amount of 0');
            return amountAfterFees;
        }
        route.forEach((routeHop) => {
            const pool = routeHop.pool;
            switch (routeHop.pool.poolType) {
                case Pool_1.PoolType.XYK:
                    const xykPool = pool;
                    const x1 = new bignumber_js_1.default(xykPool.poolAssets.find((poolAsset) => poolAsset.token.denom === routeHop.tokenInDenom)?.token.amount);
                    const y1 = new bignumber_js_1.default(xykPool.poolAssets.find((poolAsset) => poolAsset.token.denom === routeHop.tokenOutDenom)?.token.amount);
                    const amountInBeforeFees = (0, math_1.calculateRequiredInputXYKPool)(new bignumber_js_1.default(x1), new bignumber_js_1.default(y1), new bignumber_js_1.default(tokenOutRequired));
                    amountAfterFees = amountInBeforeFees.plus(tokenOutRequired.multipliedBy(routeHop.pool.swapFee));
                    tokenOutRequired = amountAfterFees;
                    break;
                case Pool_1.PoolType.CONCENTRATED_LIQUIDITY:
                    const clPool = pool;
                    const tokenOut = {
                        denom: routeHop.tokenOutDenom,
                        amount: new unit_1.Int(tokenOutRequired.toFixed(0))
                    };
                    const tokenDenom0 = clPool.token0;
                    const poolLiquidity = new unit_1.Dec(clPool.currentTickLiquidity);
                    const inittedTicks = tokenOut.denom === tokenDenom0 ? clPool.liquidityDepths.zeroToOne : clPool.liquidityDepths.oneToZero;
                    const curSqrtPrice = new math_2.BigDec(clPool.currentSqrtPrice);
                    const swapFee = new unit_1.Dec(clPool.swapFee);
                    const result = math_2.ConcentratedLiquidityMath.calcInGivenOut({
                        tokenOut,
                        tokenDenom0,
                        poolLiquidity,
                        inittedTicks,
                        curSqrtPrice,
                        swapFee,
                    });
                    if (result === "no-more-ticks") {
                        tokenOutRequired = new bignumber_js_1.default(0);
                        break;
                    }
                    const { amountIn } = result;
                    amountAfterFees = new bignumber_js_1.default(amountIn.toString());
                    tokenOutRequired = amountAfterFees;
                    break;
            }
        });
        return amountAfterFees;
    }
    getBestRouteGivenInput(tokenInDenom, tokenOutDenom, amountIn) {
        const routeOptions = this.getRoutes(tokenInDenom, tokenOutDenom);
        return this.getRouteWithHighestOutput(amountIn, routeOptions);
    }
    getRouteWithHighestOutput(amountIn, routes) {
        const bestRoute = routes
            .sort((routeA, routeB) => {
            const routeAReturns = this.getOutput(amountIn, routeA);
            const routeBReturns = this.getOutput(amountIn, routeB);
            return routeAReturns.minus(routeBReturns).toNumber();
        })
            .pop();
        return bestRoute || [];
    }
    getRouteWithLowestInput(amountOut, routes) {
        const bestRoute = routes
            .filter((route) => this.getRequiredInput(amountOut, route).isGreaterThan(0))
            .sort((routeA, routeB) => {
            const routeAReturns = this.getRequiredInput(amountOut, routeA);
            const routeBReturns = this.getRequiredInput(amountOut, routeB);
            return routeBReturns.minus(routeAReturns).toNumber();
        })
            .pop();
        return bestRoute || [];
    }
    getBestRouteGivenOutput(tokenInDenom, tokenOutDenom, amountOut) {
        const routeOptions = this.getRoutes(tokenInDenom, tokenOutDenom);
        return this.getRouteWithLowestInput(amountOut, routeOptions);
    }
    getRoutes(tokenInDenom, tokenOutDenom) {
        return this.buildRoutesForTrade(tokenInDenom, tokenOutDenom, this.pools);
    }
    buildRoutesForTrade(tokenInDenom, targetTokenOutDenom, pools) {
        const completeRoutes = [];
        let routesInProgress = [];
        let maxRoutteLength = 2;
        const startingPairs = pools.filter((pool) => pool.token0 === tokenInDenom || pool.token1 === tokenInDenom);
        startingPairs.forEach((pair) => {
            const hop = {
                poolId: pair.id,
                tokenInDenom: tokenInDenom,
                tokenOutDenom: tokenInDenom === pair.token0 ? pair.token1 : pair.token0,
                pool: pair,
            };
            const route = [];
            route.push(hop);
            if (hop.tokenOutDenom === targetTokenOutDenom) {
                completeRoutes.push(route);
            }
            else {
                routesInProgress.push(route);
            }
        });
        while (routesInProgress.length > 0) {
            let updatedRoutes = [];
            routesInProgress.forEach((route) => {
                let usedPoolIds = this.findUsedPools(route);
                let usedDenoms = route.map((hop) => hop.tokenInDenom);
                let lastDenom = route[route.length - 1].tokenOutDenom;
                pools.forEach((pool) => {
                    if ((pool.token0 === lastDenom ||
                        pool.token1 === lastDenom) &&
                        (usedDenoms.indexOf(pool.token0) === -1 &&
                            usedDenoms.indexOf(pool.token1) === -1) &&
                        usedPoolIds.indexOf(pool.id) === -1) {
                        const hop = {
                            poolId: pool.id,
                            tokenInDenom: lastDenom,
                            tokenOutDenom: lastDenom === pool.token0 ? pool.token1 : pool.token0,
                            pool: pool,
                        };
                        const routeClone = this.cloneRoute(route);
                        routeClone.push(hop);
                        if (hop.tokenOutDenom === targetTokenOutDenom) {
                            completeRoutes.push(routeClone);
                        }
                        else if (routeClone.length < maxRoutteLength) {
                            updatedRoutes.push(routeClone);
                        }
                    }
                });
            });
            routesInProgress = updatedRoutes;
        }
        return completeRoutes;
    }
    cloneRoute(route) {
        return route.map((hop) => {
            return {
                poolId: hop.poolId,
                tokenInDenom: hop.tokenInDenom,
                tokenOutDenom: hop.tokenOutDenom,
                pool: hop.pool,
            };
        });
    }
}
exports.AMMRouter = AMMRouter;
//# sourceMappingURL=AmmRouter.js.map