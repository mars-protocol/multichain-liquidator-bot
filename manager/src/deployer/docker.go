package deployer

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	dockerclient "github.com/docker/docker/client"
	"github.com/google/uuid"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
	"github.com/sirupsen/logrus"
)

// Docker implements a deployment mechanism using Docker as the orchestrator
type Docker struct {
	service      string
	container    string
	containerEnv map[string]string

	client                *dockerclient.Client
	requestedServiceCount int

	logger *logrus.Entry
}

// NewDocker creates a new instance of the Docker deployer that will deploy
// the given container
func NewDocker(
	service string,
	container string,
	containerEnv map[string]string,
	logger *logrus.Entry,
) (*Docker, error) {

	client, err := dockerclient.NewClientWithOpts(dockerclient.FromEnv)
	if err != nil {
		return nil, err
	}

	// No environment variables specified
	if containerEnv == nil {
		containerEnv = make(map[string]string)
	}

	return &Docker{
		service:      service,
		container:    container,
		containerEnv: containerEnv,
		client:       client,
		logger: logger.WithFields(logrus.Fields{
			"subservice": "deployer",
			"type":       "docker",
		}),
	}, nil
}

// Increase the number of services deployed
func (dep *Docker) Increase() error {
	if dep.IsDeploying() {
		return errors.New("unable to increase while deployment is in progress")
	}

	dep.requestedServiceCount++
	var env []string
	for key, value := range dep.containerEnv {
		env = append(env, fmt.Sprintf("%s=%s", key, value))
	}

	containerName := fmt.Sprintf("%s.%s", dep.service, uuid.NewString())

	containerDetails, err := dep.client.ContainerCreate(
		context.Background(),
		&container.Config{
			Image: dep.container,
			Env:   env,
		},
		&container.HostConfig{
			AutoRemove: true,
			RestartPolicy: container.RestartPolicy{
				MaximumRetryCount: 0,
			},
			NetworkMode: "host",
		},
		&network.NetworkingConfig{},
		&v1.Platform{},
		containerName)
	if err != nil {
		return err
	}

	err = dep.client.ContainerStart(
		context.Background(),
		containerDetails.ID,
		types.ContainerStartOptions{})
	if err != nil {
		return err
	}

	// TODO: A possible improvement here is to start a routine to check that the
	// container actually starts correctly

	dep.logger.WithFields(logrus.Fields{
		"name":           containerName,
		"total_services": dep.requestedServiceCount,
	}).Info("Deployed new instance")

	return err
}

// Decrease the number of services deployed
func (dep *Docker) Decrease() error {
	if dep.IsDeploying() {
		return errors.New("unable to decrease while deployment is in progress")
	}

	// Find all the running service containers and stop them all
	serviceContainers, err := dep.getRunningServiceContainers()
	if err != nil {
		return err
	}

	if len(serviceContainers) == 0 {
		return nil
	}

	dep.requestedServiceCount--

	// Only kill the first one
	serviceContainer := serviceContainers[0]
	// Remove kills and removes the first container
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

	dep.logger.WithFields(logrus.Fields{
		"name":           serviceContainer.Names,
		"total_services": dep.requestedServiceCount,
	}).Info("Removed deployed instance")

	return nil
}

// RemoveAll removes all the services from deployment
func (dep *Docker) RemoveAll() error {
	dep.requestedServiceCount = 0
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
	dep.logger.WithFields(logrus.Fields{
		"removed":        len(serviceContainers),
		"total_services": dep.requestedServiceCount,
	}).Info("Removed all deployed instances")
	return nil
}

// Count returns the amount of services deployed
func (dep *Docker) Count() (int, error) {
	serviceContainers, err := dep.getRunningServiceContainers()
	return len(serviceContainers), err
}

func (dep *Docker) getRunningServiceContainers() ([]types.Container, error) {
	var serviceContainers []types.Container

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
		return serviceContainers, err
	}

	for _, container := range containers {
		for _, name := range container.Names {
			// Container names start with a forward slash for some reason
			// Strip the leading slash
			name = name[1:]
			// When we deploy the service we set the name as 'service.uuid'
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
	currentCount, err := dep.Count()
	if err != nil {
		return false
	}

	// If our current count doesn't match the requested count we're still
	// deploying
	if currentCount != dep.requestedServiceCount {
		return true
	}

	return false
}
