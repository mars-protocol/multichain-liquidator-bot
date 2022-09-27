package types

// HealthCheckWorkItem defines the parameters for the collector to send to the
// health checker
type HealthCheckWorkItem struct {
	Address    string       `json:"address"`
	Debts      []Debts      `json:"debts"`
	Collateral []Collateral `json:"collateral"`
	Endpoints  Endpoints    `json:"endpoints"`
}

// Debts denote the format for debts
type Debts struct {
	Token  string `json:"token"`
	Amount string `json:"amount"`
}

// Debts denote the format for collateral
type Collateral struct {
	Token  string `json:"token"`
	Amount int    `json:"amount"`
}

// Endpoints denote the format for usable endpoints
type Endpoints struct {
	Hive string `json:"hive"`
	LCD  string `json:"lcd"`
	RPC  string `json:"rpc"`
}
