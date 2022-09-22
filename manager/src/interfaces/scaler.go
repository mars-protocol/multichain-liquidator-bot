package interfaces

// Scaler defines how scaling should be handled based on the concrete
// implementation
type Scaler interface {
	// ScaleAutomatic scales the service up or down based on paramaters.
	// If scaling should be executed returns the direction (up, down)
	// and true with no error
	ScaleAutomatic() (string, bool, error)
	// ScaleUp scales the service up by one instance
	ScaleUp() error
	// ScaleDown scales the service down by one instance
	ScaleDown() error
	// ScaleToZero scales the service down to zero instances
	ScaleToZero() error
	// Count returns the amount of services deployed
	Count() (int, error)
}
