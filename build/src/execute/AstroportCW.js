"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstroportCW = void 0;
const helpers_1 = require("../helpers");
const encoding_1 = require("@cosmjs/encoding");
class AstroportCW {
    constructor(prefix, astroportRouterContract) {
        this.prefix = prefix;
        this.astroportRouterContract = astroportRouterContract;
    }
    produceSwapMessage(route, tokenIn, minimumRecieve, sender) {
        const executeSwapOperations = route.map((route) => this.produceSwapOperation(route));
        const msg = {
            execute_swap_operations: {
                operations: executeSwapOperations,
                minimum_receive: minimumRecieve
            },
        };
        return (0, helpers_1.produceExecuteContractMessage)(sender, this.astroportRouterContract, (0, encoding_1.toUtf8)(JSON.stringify(msg)), [tokenIn]);
    }
    produceSwapOperation(routeHop) {
        return {
            astro_swap: {
                offer_asset_info: this.produceAssetInfo(routeHop.tokenInDenom),
                ask_asset_info: this.produceAssetInfo(routeHop.tokenOutDenom)
            }
        };
    }
    produceAssetInfo(denom) {
        if (denom.startsWith(this.prefix)) {
            return this.produceAssetInfoCW(denom);
        }
        return this.produceAssetInfoNative(denom);
    }
    produceAssetInfoCW(denom) {
        return {
            token: {
                contract_addr: denom
            }
        };
    }
    produceAssetInfoNative(denom) {
        return {
            native_token: {
                denom
            }
        };
    }
}
exports.AstroportCW = AstroportCW;
//# sourceMappingURL=AstroportCW.js.map