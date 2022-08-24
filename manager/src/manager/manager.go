package manager

import (
	"errors"
	"sync/atomic"

	"github.com/sirupsen/logrus"
)

// Manager implements the management service for the collection of services
// for the liquidation bot
type Manager struct {
	rpcWebsocketEndpoint string

	logger *logrus.Entry

	continueRunning uint32
}

// New creates a new instance of the manager and returns the instance and an
// error if applicable
func New(rpcWebsocketEndpoint string, logger *logrus.Entry) (*Manager, error) {

	if rpcWebsocketEndpoint == "" {
		return nil, errors.New("rpcWebsocketEndpoint must not be blank")
	}

	return &Manager{
		rpcWebsocketEndpoint: rpcWebsocketEndpoint,
		logger:               logger,
		continueRunning:      0,
	}, nil
}

// Run the service forever
func (service *Manager) Run() error {
	// Set long running routines to run
	atomic.StoreUint32(&service.continueRunning, 1)

	// Set up the receiver channel for new blocks received via the websocket
	newBlockReceiver, err := service.newBlockReceiver(service.rpcWebsocketEndpoint)
	if err != nil {
		return err
	}

	for newBlock := range newBlockReceiver {
		service.logger.WithFields(logrus.Fields{
			"height":    newBlock.Result.Data.Value.Block.Header.Height,
			"timestamp": newBlock.Result.Data.Value.Block.Header.Time,
		}).Info("Processing new block")

		// TODO: Send out new work for the collector
		// TODO: Send out notification to the scaler to monitor?
		// TODO: We need to monitor how long ago we received a new block
		// 		if we don't receive a new block in X seconds, we need to
		// 		potentially reconnect
	}

	return nil
}

// Stop the manager service
// Stopping the service will take a few seconds to cleanly disconnect the
// websocket subscription
func (service *Manager) Stop() error {
	// Block long running routines from continuing
	atomic.StoreUint32(&service.continueRunning, 0)
	return nil
}
