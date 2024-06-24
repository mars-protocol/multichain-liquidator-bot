import BigNumber from 'bignumber.js';
import { RouteHop } from './types/RouteHop';
import { Pool } from './types/Pool';
export interface AMMRouterInterface {
    getRoutes(tokenInDenom: string, tokenOutDenom: string): RouteHop[][];
}
export declare class AMMRouter implements AMMRouterInterface {
    private pools;
    constructor();
    setPools(pools: Pool[]): void;
    getPools(): Pool[];
    getPool(id: string): Pool | undefined;
    getOutput(tokenInAmount: BigNumber, route: RouteHop[]): BigNumber;
    getRequiredInput(tokenOutRequired: BigNumber, route: RouteHop[]): BigNumber;
    getBestRouteGivenInput(tokenInDenom: string, tokenOutDenom: string, amountIn: BigNumber): RouteHop[];
    getRouteWithHighestOutput(amountIn: BigNumber, routes: RouteHop[][]): RouteHop[];
    getRouteWithLowestInput(amountOut: BigNumber, routes: RouteHop[][]): RouteHop[];
    getBestRouteGivenOutput(tokenInDenom: string, tokenOutDenom: string, amountOut: BigNumber): RouteHop[];
    getRoutes(tokenInDenom: string, tokenOutDenom: string): RouteHop[][];
    private findUsedPools;
    private buildRoutesForTrade;
    cloneRoute(route: RouteHop[]): {
        poolId: import("long").Long;
        tokenInDenom: string;
        tokenOutDenom: string;
        pool: Pool;
    }[];
}
