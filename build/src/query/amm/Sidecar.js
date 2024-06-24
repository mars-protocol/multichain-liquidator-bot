"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoute = void 0;
const getRoute = async (baseUrl, amount, from, to) => {
    const response = await fetch(`${baseUrl}/router/quote?tokenIn=${amount}${from}&tokenOutDenom=${to}`);
    return response.json();
};
exports.getRoute = getRoute;
//# sourceMappingURL=Sidecar.js.map