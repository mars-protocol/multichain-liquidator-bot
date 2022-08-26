package deployer

import "github.com/sirupsen/logrus"

// Docker implements a deployment mechanism using Docker as the orchestrator
type Docker struct {
	container string

	isDeploying bool

	logger *logrus.Entry
}

// NewDocker creates a new instance of the Docker deployer that will deploy
// the given container
func NewDocker(container string, logger *logrus.Entry) (*Docker, error) {
	return &Docker{
		container: container,
		logger: logger.WithFields(logrus.Fields{
			"subservice": "deployer",
			"type":       "docker",
		}),
	}, nil
}

// Increase the number of services deployed
func (dep *Docker) Increase() error {
	dep.isDeploying = true
	return nil
}

// Decrease the number of services deployed
func (dep *Docker) Decrease() error {
	dep.isDeploying = true
	return nil
}

// RemoveAll removes all the services from deployment
func (dep *Docker) RemoveAll() error {
	dep.isDeploying = true
	return nil
}

// Count returns the amount of services deployed
func (dep *Docker) Count() (int, error) {
	return 0, nil
}

// IsDeploying returns true while an increase or decrease of services have
// been requested but not completed yet
func (dep *Docker) IsDeploying() bool {
	return dep.isDeploying
}
