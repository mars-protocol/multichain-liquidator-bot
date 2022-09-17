export interface LiquidationTx {
    /// Denom of the collateral asset, which liquidator gets from the borrower
    collateral_denom: string,
    /// Denom of the debt asset
    debt_denom: string,
    /// The address of the borrower getting liquidated
    user_address: string,
    // the amount of debt to be repaid
    amount: string
}

export interface LiquidationResult {
    collateralReceivedDenom : string
    debtRepaidDenom: string
    debtRepaidAmount : string
    collateralReceivedAmount : string
}


