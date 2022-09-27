package collector

// DebtMapValue contains the format of the value of a key in the DEBTS map
// in the Red Bank contract
type DebtMapValue struct {
	AmountScaled string `json:"amount_scaled"`
}
