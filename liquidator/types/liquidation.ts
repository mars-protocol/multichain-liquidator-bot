export interface LiquidationTx {
    /// Denom of the collateral asset, which liquidator gets from the borrower
    collateral_denom: String,
    /// Denom of the debt asset
    debt_denom: String,
    /// The address of the borrower getting liquidated
    user_address: String,
    /// Whether the liquidator gets liquidated collateral in maToken (true) or
    /// the underlying collateral asset (false)
    receive_ma_token: boolean,
}

export interface LiquidationResult {
    ok: string // todo
}


