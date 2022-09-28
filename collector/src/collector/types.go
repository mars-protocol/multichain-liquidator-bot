package collector

// DebtCollateralMapValue contains the format of the value of a key in the DEBTS
// and COLLATERAL maps in the Red Bank contract
// We only parse amount_scaled as we're not interested in the other values
type DebtCollateralMapValue struct {
	AmountScaled string `json:"amount_scaled"`
}
