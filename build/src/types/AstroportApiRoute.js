"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toRouteHopArray = void 0;
const Pool_1 = require("./Pool");
const toRouteHopArray = (astroRoute) => {
    return astroRoute.swaps.map((swap) => {
        return {
            poolId: 0,
            tokenInDenom: astroRoute.denom_in,
            tokenOutDenom: astroRoute.denom_out,
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
};
exports.toRouteHopArray = toRouteHopArray;
//# sourceMappingURL=AstroportApiRoute.js.map