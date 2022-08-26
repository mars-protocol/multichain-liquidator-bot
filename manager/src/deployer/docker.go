package deployer

import (
	"context"
	"strings"

	"github.com/docker/docker/api/types"
	dockerclient "github.com/docker/docker/client"
	"github.com/sirupsen/logrus"
)

// Docker implements a deployment mechanism using Docker as the orchestrator
type Docker struct {
	service   string
	container string

	client      *dockerclient.Client
	isDeploying bool

	logger *logrus.Entry
}

// NewDocker creates a new instance of the Docker deployer that will deploy
// the given container
func NewDocker(
	service string,
	container string,
	logger *logrus.Entry,
) (*Docker, error) {

	client, err := dockerclient.NewClientWithOpts(dockerclient.FromEnv)
	if err != nil {
		return nil, err
	}

	return &Docker{
		service:   service,
		container: container,
		client:    client,
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
	// Find all the running service containers and stop them all
	serviceContainers, err := dep.getRunningServiceContainers()
	if err != nil {
		return err
	}

	for _, serviceContainer := range serviceContainers {
		// Remove kills and removes the container
		err = dep.client.ContainerRemove(
			context.Background(),
			serviceContainer.ID,
			// We force the removal as we don't really care about any
			// issues when killing it, we just want it gone
			types.ContainerRemoveOptions{
				Force: true,
			},
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// Count returns the amount of services deployed
func (dep *Docker) Count() (int, error) {
	serviceContainers, err := dep.getRunningServiceContainers()
	return len(serviceContainers), err
}

func (dep *Docker) getRunningServiceContainers() ([]types.Container, error) {
	// For docker we need to find the amount of running containers
	// with the names we specified during deployment
	// We do that by iterating over the list of containers and simply adding
	// them to the list
	containers, err := dep.client.ContainerList(
		context.Background(),
		types.ContainerListOptions{
			All: true,
		},
	)
	if err != nil {
		return 0, err
	}

	var serviceContainers []types.Container
	for _, container := range containers {
		for _, name := range container.Names {
			// Container names start with a forward slash for some reason
			// Strip the leading slash
			name = name[1:]
			// When we deploy the service we set the name as 'service:uuid'
			// so when finding it we look for the service prefix
			if strings.HasPrefix(name, dep.service) {
				serviceContainers = append(serviceContainers, container)
				// Once this name has been counted, move to the next container
				break
			}
		}
	}
	return serviceContainers, nil
}

// IsDeploying returns true while an increase or decrease of services have
// been requested but not completed yet
func (dep *Docker) IsDeploying() bool {
	return dep.isDeploying
}
