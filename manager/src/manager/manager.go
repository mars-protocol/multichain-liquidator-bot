package manager

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/sirupsen/logrus"
	lens "github.com/strangelove-ventures/lens/client"

	managerinterfaces "github.com/mars-protocol/multichain-liquidator-bot/manager/src/interfaces"
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
	scalers              map[string]managerinterfaces.Scaler

	rpcEndpoint       string
	collectorContract string

	logger *logrus.Entry

	lastBlockTime   time.Time
	continueRunning uint32

	waitGroup   sync.WaitGroup
	monitorLock sync.RWMutex
}

// New creates a new instance of the manager and returns the instance and an
// error if applicable
func New(
	rpcEndpoint string,
	rpcWebsocketEndpoint string,
	queue interfaces.Queuer,
	collectorQueueName string,
	healthCheckQueueName string,
	executorQueueName string,
	scalers map[string]managerinterfaces.Scaler,
	collectorContract string,
	logger *logrus.Entry,
) (*Manager, error) {

	if rpcEndpoint == "" || rpcWebsocketEndpoint == "" {
		return nil, errors.New("rpcEndpoint and rpcWebsocketEndpoint must not be blank")
	}

	if queue == nil {
		return nil, errors.New("queue must be set")
	}

	if collectorQueueName == "" || healthCheckQueueName == "" || executorQueueName == "" {
		return nil, errors.New("collectorQueueName, healthCheckQueueName and executorQueueName must not be blank")
	}

	if scalers == nil {
		return nil, errors.New("you must provide scalers to the manager")
	}

	if collectorContract == "" {
		return nil, errors.New("you must provide the contract to be monitored")
	}

	return &Manager{
		rpcWebsocketEndpoint: rpcWebsocketEndpoint,
		queue:                queue,
		collectorQueueName:   collectorQueueName,
		healthCheckQueueName: healthCheckQueueName,
		executorQueueName:    executorQueueName,
		scalers:              scalers,
		collectorContract:    collectorContract,
		logger:               logger,
		lastBlockTime:        time.Now(),
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

	// Watcher routines
	// We need to monitor how long ago we received a new block and if we don't
	// receive a new block in 1 minute, we need to potentially reconnect
	// This covers an edge case where we are still connected via websocket
	// but the server isn't sending us blocks for whatever reason
	service.waitGroup.Add(1)
	go func() {
		defer service.waitGroup.Done()
		err := service.monitorBlocksReceived()
		if err != nil {
			service.logger.Fatal(err)
		}
	}()

	// We need to ensure that all the elements in a contract's storage is
	// processed by the collector as well as determine how many pages/items
	// can be assigned to each instance. For that we need to know the total
	// count of items in storage. The collector could check this, however,
	// getting the total count is a slow process and is actually used here and
	// not in the collector
	service.waitGroup.Add(1)
	go func() {
		defer service.waitGroup.Done()

		err := service.monitorContractStorageSize(
			service.rpcEndpoint,
			service.collectorContract,
		)
		if err != nil {
			service.logger.Fatal(err)
		}
	}()

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

		// In the off chance we check the last block time while it is being
		// updated, we need to guard it
		service.monitorLock.Lock()
		blockTime := time.Since(service.lastBlockTime)
		service.lastBlockTime = time.Now()
		service.monitorLock.Unlock()

		// At the start of a new block, check if we had any work left for the
		// services to do
		// If there are items left in the queue, we need to scale the service
		// If there are no items left, we need to determine if we have too
		// many services running
		for scalerName, scaler := range service.scalers {
			scaleDirection, shouldScale, err := scaler.ScaleAutomatic()
			if err != nil {
				return err
			}

			if shouldScale {
				service.logger.WithFields(logrus.Fields{
					"scaler":    scalerName,
					"height":    newBlock.Result.Data.Value.Block.Header.Height,
					"direction": scaleDirection,
				}).Debug("Service is scaling")
			}
		}

		// TODO: Can we move this somewhere else
		// Clear the queue from any remaining work
		err = service.queue.Purge(service.collectorQueueName)
		if err != nil {
			return err
		}

		// TODO: Send out new work for the collector
		// TODO: This will be added when changes to the Red Bank are completed

		service.logger.WithFields(logrus.Fields{
			"height":     newBlock.Result.Data.Value.Block.Header.Height,
			"timestamp":  newBlock.Result.Data.Value.Block.Header.Time,
			"block_time": blockTime,
		}).Info("Block processed")
	}

	// Wait for all our routines to complete and exit
	service.waitGroup.Wait()
	return nil
}

// monitorBlocksReceived checks the delay in blocks received for safety.
// If we aren't receiving blocks for an extended time, we need to exit
// and restart the service
func (service *Manager) monitorBlocksReceived() error {
	for atomic.LoadUint32(&service.continueRunning) == 1 {

		service.monitorLock.RLock()
		lastBlockTime := service.lastBlockTime
		service.monitorLock.RUnlock()

		service.logger.WithFields(logrus.Fields{
			"last_block_received":       lastBlockTime,
			"since_last_block_received": time.Since(lastBlockTime),
		}).Debug("Checking if we are receiving blocks")
		if time.Since(lastBlockTime) >= time.Minute {
			return fmt.Errorf("no new block received in %v", time.Since(lastBlockTime))
		}
		// Check this every 10 seconds
		time.Sleep(time.Second * 10)
	}
	return nil
}

// monitorContractStorageSize gets the total amount of items in a contract's
// storage to help determine whether everything is being processed as well
// as making decisions on how many pages can be completed by an instance
func (service *Manager) monitorContractStorageSize(
	rpcEndpoint string,
	contractAddress string,
) error {
	for atomic.LoadUint32(&service.continueRunning) == 1 {

		start := time.Now()

		// Blocks are usually less than 6 seconds, we give ourselves an absolute
		// maximum of 5 seconds to get the information. Ideally, it should be faster
		client, err := lens.NewRPCClient(rpcEndpoint, time.Second*5)
		if err != nil {
			return err
		}

		var stateRequest QueryAllContractStateRequest
		stateRequest.Address = contractAddress
		stateRequest.Pagination = &PageRequest{
			Offset:     0,
			Limit:      1,
			CountTotal: true,
		}

		// The structure of the request requires the query parameters to be passed
		// as protobuf encoded content
		rpcRequest, err := proto.Marshal(&stateRequest)
		if err != nil {
			return err
		}

		rpcResponse, err := client.ABCIQuery(
			context.Background(),
			// RPC query path for the raw state
			"/cosmwasm.wasm.v1.Query/AllContractState",
			rpcRequest,
		)
		if err != nil {
			return err
		}

		// The value in the response also contains the contract state in
		// protobuf encoded format
		var stateResponse QueryAllContractStateResponse
		err = proto.Unmarshal(rpcResponse.Response.GetValue(), &stateResponse)
		if err != nil {
			return err
		}

		service.logger.WithFields(logrus.Fields{
			"total":      stateResponse.Pagination.Total,
			"elapsed_ms": time.Since(start).Milliseconds(),
		}).Debug("Fetched contract items")

		// TODO Compare total amount of items vs total collected by the collector
		// TODO Store the total amount of items
		// TODO This will be implemented after changes are completed by Red Bank

		// Check this every 10 seconds
		time.Sleep(time.Second * 10)
	}
	return nil
}

// Stop the manager service
// Stopping the service will take a few seconds to cleanly disconnect the
// websocket subscription
func (service *Manager) Stop() error {
	// Block long running routines from continuing
	atomic.StoreUint32(&service.continueRunning, 0)
	// Remove all services
	for _, scaler := range service.scalers {
		scaler.ScaleToZero()
	}
	return nil
}