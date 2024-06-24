"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstroportRouteRequester = void 0;
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const Pool_1 = require("../../types/Pool");
class AstroportRouteRequester {
    async requestRoute(apiUrl, tokenInDenom, tokenOutDenom, tokenOutAmount) {
        let url = `${apiUrl}routes?start=${tokenInDenom}&end=${tokenOutDenom}&amount=${tokenOutAmount}&chainId=neutron-1&limit=5`;
        console.log(url);
        let response = await fetch(url);
        let astroportRoutes = await response.json();
        let bestRoute = astroportRoutes
            .sort((a, b) => {
            let a_val = new bignumber_js_1.default(a.value_out);
            let b_val = new bignumber_js_1.default(b.value_out);
            return a_val.minus(b_val).toNumber();
        }).pop();
        if (!bestRoute) {
            throw new Error(`No route found for ${tokenInDenom} to ${tokenOutDenom}`);
        }
        let routeHops = bestRoute?.swaps.map((swap) => {
            return {
                poolId: 0,
                tokenInDenom: swap.from,
                tokenOutDenom: swap.to,
                pool: {
                    token0: swap.from,
                    token1: swap.to,
                    id: 0,
                    swapFee: "0.003",
                    address: swap.contract_addr,
                    poolType: Pool_1.PoolType.XYK,
                },
            };
        });
        const minOutput = new bignumber_js_1.default(bestRoute.value_out)
            .multipliedBy(0.975)
            .toFixed(0);
        return {
            route: routeHops,
            expectedOutput: minOutput,
        };
    }
}
exports.AstroportRouteRequester = AstroportRouteRequester;
//# sourceMappingURL=AstroportRouteRequester.js.map