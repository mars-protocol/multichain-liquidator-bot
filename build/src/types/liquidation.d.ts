export interface LiquidationTx {
    collateral_denom: string;
    debt_denom: string;
    user_address: string;
    amount: string;
}
export interface LiquidationResult {
    collateralReceivedDenom: string;
    debtRepaidDenom: string;
    debtRepaidAmount: string;
    collateralReceivedAmount: string;
}
