"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSlippageBp = exports.calculateRequiredInputXYKPool = exports.calculateOutputXYKPool = void 0;
const calculateOutputXYKPool = (x1, y1, xChange) => {
    return xChange.dividedBy(x1.plus(xChange)).multipliedBy(y1);
};
exports.calculateOutputXYKPool = calculateOutputXYKPool;
const calculateRequiredInputXYKPool = (x1, y1, yChange) => {
    return yChange.dividedBy(y1.minus(yChange)).multipliedBy(x1);
};
exports.calculateRequiredInputXYKPool = calculateRequiredInputXYKPool;
const calculateSlippageBp = (x1, y1, xChange) => {
    const initialPrice = x1.dividedBy(y1);
    const estimatedSettlementPrice = (0, exports.calculateOutputXYKPool)(x1, y1, xChange);
    const priceDifference = initialPrice.minus(estimatedSettlementPrice);
    const percentageDifference = priceDifference.dividedBy(initialPrice).multipliedBy(100);
    return percentageDifference.multipliedBy(100);
};
exports.calculateSlippageBp = calculateSlippageBp;
//# sourceMappingURL=math.js.map