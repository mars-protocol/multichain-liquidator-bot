"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SWAP_SLIPPAGE_LIMIT = exports.GENERIC_BUFFER = exports.REDEEM_BASE = exports.COLLATERALS = exports.DEBTS = exports.QueryType = void 0;
var QueryType;
(function (QueryType) {
    QueryType[QueryType["DEBTS"] = 0] = "DEBTS";
    QueryType[QueryType["COLLATERALS"] = 1] = "COLLATERALS";
})(QueryType = exports.QueryType || (exports.QueryType = {}));
exports.DEBTS = 'debts';
exports.COLLATERALS = 'collaterals';
exports.REDEEM_BASE = (1e16).toString();
exports.GENERIC_BUFFER = 0.99;
exports.DEFAULT_SWAP_SLIPPAGE_LIMIT = '0.005';
//# sourceMappingURL=constants.js.map