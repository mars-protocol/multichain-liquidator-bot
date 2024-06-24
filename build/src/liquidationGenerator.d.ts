import { AssetResponse, Collateral, Debt } from './query/types';
export declare const getLargestCollateral: (collaterals: Collateral[], prices: Map<string, number>) => string;
export declare const getLargestDebt: (debts: Debt[], prices: Map<string, number>) => AssetResponse;
