"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Osmosis = void 0;
const osmojs_1 = require("osmojs");
const { swapExactAmountIn } = osmojs_1.osmosis.gamm.v1beta1.MessageComposer.withTypeUrl;
class Osmosis {
    produceSwapMessage(route, tokenIn, minimumRecieve, sender) {
        return swapExactAmountIn({
            sender,
            routes: route?.map((route) => {
                return { poolId: route.poolId, tokenOutDenom: route.tokenOutDenom };
            }),
            tokenIn,
            tokenOutMinAmount: minimumRecieve,
        });
    }
}
exports.Osmosis = Osmosis;
//# sourceMappingURL=Osmosis.js.map