import BigNumber from 'bignumber.js';
export declare const calculateOutputXYKPool: (x1: BigNumber, y1: BigNumber, xChange: BigNumber) => BigNumber;
export declare const calculateRequiredInputXYKPool: (x1: BigNumber, y1: BigNumber, yChange: BigNumber) => BigNumber;
export declare const calculateSlippageBp: (x1: BigNumber, y1: BigNumber, xChange: BigNumber) => BigNumber;
