package manager

import (
	"errors"
	"sync/atomic"

	"github.com/sirupsen/logrus"

	managerinterfaces "github.com/mars-protocol/multichain-liquidator-bot/monitor/src/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
)

// Manager implements the management service for the collection of services
// for the liquidation bot
type Manager struct {
	rpcWebsocketEndpoint string
	queue                interfaces.Queuer
	collectorQueueName   string
	healthCheckQueueName string
	executorQueueName    string

	collectorScaler managerinterfaces.Scaler

	logger *logrus.Entry

	continueRunning uint32
}

// New creates a new instance of the manager and returns the instance and an
// error if applicable
func New(
	rpcWebsocketEndpoint string,
	queue interfaces.Queuer,
	collectorQueueName string,
	healthCheckQueueName string,
	executorQueueName string,
	collectorScaler managerinterfaces.Scaler,
	logger *logrus.Entry,
) (*Manager, error) {

	if rpcWebsocketEndpoint == "" {
		return nil, errors.New("rpcWebsocketEndpoint must not be blank")
	}

	if queue == nil {
		return nil, errors.New("queue must be set")
	}

	if collectorQueueName == "" || healthCheckQueueName == "" || executorQueueName == "" {
		return nil, errors.New("collectorQueueName, healthCheckQueueName and executorQueueName must not be blank")
	}

	if collectorScaler == nil {
		return nil, errors.New("collectorScaler must be provided")
	}

	return &Manager{
		rpcWebsocketEndpoint: rpcWebsocketEndpoint,
		queue:                queue,
		collectorQueueName:   collectorQueueName,
		healthCheckQueueName: healthCheckQueueName,
		executorQueueName:    executorQueueName,
		collectorScaler:      collectorScaler,
		logger:               logger,
		continueRunning:      0,
	}, nil
}

// Run the service forever
func (service *Manager) Run() error {
	// Ensure we are connected to the queue
	err := service.queue.Connect()
	if err != nil {
		return err
	}
	defer service.queue.Disconnect()

	// Set long running routines to run
	atomic.StoreUint32(&service.continueRunning, 1)

	// Set up the receiver channel for new blocks received via the websocket
	newBlockReceiver, err := service.newBlockReceiver(service.rpcWebsocketEndpoint)
	if err != nil {
		return err
	}

	// Read new blocks from the channel until the channel is closed
	for newBlock := range newBlockReceiver {

		service.logger.WithFields(logrus.Fields{
			"height":    newBlock.Result.Data.Value.Block.Header.Height,
			"timestamp": newBlock.Result.Data.Value.Block.Header.Time,
		}).Debug("Processing new block")

		// At the start of a new block, check if we had any work left for the
		// collector to do
		// If there are items left in the queue, we need to scale the collector
		// If there are no items left, we need to determine if we have too
		// many collectors running
		// Clear the items out at the start of a block
		scaleDirection, shouldScale, err := service.collectorScaler.ScaleAutomatic()
		if err != nil {
			return err
		}

		if shouldScale {
			service.logger.WithFields(logrus.Fields{
				"height":    newBlock.Result.Data.Value.Block.Header.Height,
				"direction": scaleDirection,
			}).Debug("Service is scaling")
		}

		// Clear the queue from any remaining work
		err = service.queue.Purge(service.collectorQueueName)
		if err != nil {
			return err
		}

		// TODO: Send out new work for the collector
		// TODO: Send out notification to the scaler to monitor?
		// TODO: We need to monitor how long ago we received a new block
		// 		if we don't receive a new block in X seconds, we need to
		// 		potentially reconnect

		service.logger.WithFields(logrus.Fields{
			"height":    newBlock.Result.Data.Value.Block.Header.Height,
			"timestamp": newBlock.Result.Data.Value.Block.Header.Time,
		}).Info("Block processed")
	}

	return nil
}

// Stop the manager service
// Stopping the service will take a few seconds to cleanly disconnect the
// websocket subscription
func (service *Manager) Stop() error {
	// Block long running routines from continuing
	atomic.StoreUint32(&service.continueRunning, 0)
	// Remove all collector services
	return service.collectorScaler.ScaleToZero()
}
