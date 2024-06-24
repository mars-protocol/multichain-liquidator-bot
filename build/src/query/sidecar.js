"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoute = void 0;
const long_1 = __importDefault(require("long"));
const Pool_1 = require("../types/Pool");
const getRoute = async (baseUrl, amountIn, inDenom, outDenom) => {
    let url = `${baseUrl}/router/quote?tokenIn=${amountIn}${inDenom}&tokenOutDenom=${outDenom}`;
    const response = await fetch(url);
    if (response.ok === false) {
        throw new Error(`Failed to fetch route: ${response.statusText}, ${url}`);
    }
    let routeResponse = await response.json();
    let route = routeResponse.route[0].pools.map((pool) => {
        let routeHop = {
            poolId: new long_1.default(pool.id),
            tokenInDenom: inDenom,
            tokenOutDenom: pool.token_out_denom,
            pool: {
                address: "todo",
                id: new long_1.default(pool.id),
                poolType: (0, Pool_1.fromString)(pool.type.toString()),
                swapFee: pool.spread_factor,
                token0: inDenom,
                token1: pool.token_out_denom
            }
        };
        inDenom = pool.token_out_denom;
        return routeHop;
    });
    return route;
};
exports.getRoute = getRoute;
//# sourceMappingURL=sidecar.js.map