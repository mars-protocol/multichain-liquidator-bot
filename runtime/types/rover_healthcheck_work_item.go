package types

// HealthCheckWorkItem defines the parameters for the collector to send to the
// health checker
type RoverHealthCheckWorkItem struct {
	Identifier string    `json:"identifier"`
	Endpoints  Endpoints `json:"endpoints"`
}
