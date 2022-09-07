package deployer

// Mock implements a mock deployment mechanism
type Mock struct {
	serviceCount int
}

// NewMock creates a new instance of the Mock deployer that will deploy
// the given container
func NewMock() *Mock {

	return &Mock{
		serviceCount: 0,
	}
}

// Increase the number of services deployed
func (dep *Mock) Increase() error {
	dep.serviceCount++
	return nil
}

// Decrease the number of services deployed
func (dep *Mock) Decrease() error {
	dep.serviceCount--
	return nil
}

// RemoveAll removes all the services from deployment
func (dep *Mock) RemoveAll() error {
	dep.serviceCount = 0
	return nil
}

// Count returns the amount of services deployed
func (dep *Mock) Count() (int, error) {
	return dep.serviceCount, nil
}

// IsDeploying returns true while an increase or decrease of services have
// been requested but not completed yet
func (dep *Mock) IsDeploying() bool {
	return false
}
