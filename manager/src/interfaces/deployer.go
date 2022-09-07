package interfaces

// Deployer defines the behaviour of a component that handles deployment
// of services
type Deployer interface {
	// Increase the number of services deployed
	Increase() error
	// Decrease the number of services deployed
	Decrease() error
	// RemoveAll removes all the services from deployment
	RemoveAll() error
	// Count returns the amount of services deployed
	Count() (int, error)
	// IsDeploying returns true while an increase or decrease of services have
	// been requested but not completed yet
	IsDeploying() bool
}
