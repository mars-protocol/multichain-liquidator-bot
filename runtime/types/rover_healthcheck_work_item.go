package types

// HealthCheckWorkItem defines the parameters for the collector to send to the
// health checker
type RoverHealthCheckWorkItem struct {
	AccountId string    `json:"address"`
	Endpoints Endpoints `json:"endpoints"`
}
