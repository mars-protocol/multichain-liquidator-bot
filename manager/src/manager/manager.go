package manager

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/sirupsen/logrus"
	lens "github.com/strangelove-ventures/lens/client"

	managerinterfaces "github.com/mars-protocol/multichain-liquidator-bot/manager/src/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/types"
)

// Manager implements the management service for the collection of services
// for the liquidation bot
type Manager struct {
	chainID              string
	rpcWebsocketEndpoint string
	queue                interfaces.Queuer
	metricsCache         interfaces.Cacher
	collectorQueueName   string
	healthCheckQueueName string
	executorQueueName    string
	scalers              map[string]managerinterfaces.Scaler

	rpcEndpoint             string
	lcdEndpoint             string
	hiveEndpoint            string
	collectorContract       string
	collectorItemsPerPacket int

	contractItemPrefix string
	workItemType       types.WorkItemType

	metricsEnabled bool

	logger *logrus.Entry

	lastBlockTime               time.Time
	collectorTotalContractItems uint64
	continueRunning             uint32

	waitGroup   sync.WaitGroup
	monitorLock sync.RWMutex
}

// New creates a new instance of the manager and returns the instance and an
// error if applicable
func New(
	chainID string,
	rpcEndpoint string,
	rpcWebsocketEndpoint string,
	lcdEndpoint string,
	hiveEndpoint string,
	queue interfaces.Queuer,
	metricsCache interfaces.Cacher,
	collectorQueueName string,
	healthCheckQueueName string,
	executorQueueName string,
	scalers map[string]managerinterfaces.Scaler,
	collectorContract string,
	collectorItemsPerPacket int,
	contractItemPrefix string,
	workItemType types.WorkItemType,
	metricsEnabled bool,
	logger *logrus.Entry,
) (*Manager, error) {

	if rpcEndpoint == "" || rpcWebsocketEndpoint == "" {
		return nil, errors.New("rpcEndpoint and rpcWebsocketEndpoint must not be blank")
	}

	if queue == nil {
		return nil, errors.New("queue must be set")
	}

	if metricsCache == nil {
		return nil, errors.New("metricsCache must be set")
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

	if workItemType != types.Redbank && workItemType != types.Rover {
		return nil, errors.New("incorrect work item type provided: ")
	}

	return &Manager{
		chainID:                 chainID,
		rpcEndpoint:             rpcEndpoint,
		rpcWebsocketEndpoint:    rpcWebsocketEndpoint,
		lcdEndpoint:             lcdEndpoint,
		hiveEndpoint:            hiveEndpoint,
		queue:                   queue,
		metricsCache:            metricsCache,
		collectorQueueName:      collectorQueueName,
		healthCheckQueueName:    healthCheckQueueName,
		executorQueueName:       executorQueueName,
		scalers:                 scalers,
		collectorContract:       collectorContract,
		collectorItemsPerPacket: collectorItemsPerPacket,
		contractItemPrefix:      contractItemPrefix,
		workItemType:            workItemType,
		logger:                  logger,
		lastBlockTime:           time.Now(),
		metricsEnabled:          metricsEnabled,
		continueRunning:         0,
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

	err = service.metricsCache.Connect()
	if err != nil {
		return err
	}
	defer service.metricsCache.Disconnect()

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

		height, err := strconv.ParseInt(newBlock.Result.Data.Value.Block.Header.Height, 10, 64)
		if err != nil {
			service.logger.WithFields(logrus.Fields{
				"height": newBlock.Result.Data.Value.Block.Header.Height,
				"error":  err,
			}).Error("Unable to parse new height value")
		}

		if service.metricsEnabled {
			// Collect current metrics for previous block of work
			metrics, err := service.collectMetrics(height - 1)
			if err != nil {
				service.logger.WithFields(logrus.Fields{
					"height": height,
					"error":  err,
				}).Error("Unable to collect metrics")
			}

			// Submitting metrics takes a second or two, don't hold up
			// the rest of the work because of it
			go func() {
				err := service.submitMetrics(metrics)
				if err != nil {
					service.logger.WithFields(logrus.Fields{
						"height": height,
						"error":  err,
					}).Error("Unable to submit metrics")
				}
			}()
		}

		service.logger.WithFields(logrus.Fields{
			"height":    height,
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
		// Only check for scaling if we're not shutting down otherwise
		// we might scale a service due to services being removed at shutdown
		if atomic.LoadUint32(&service.continueRunning) == 1 {
			for scalerName, scaler := range service.scalers {
				scaleDirection, shouldScale, err := scaler.ScaleAutomatic()
				if err != nil {
					return err
				}

				if shouldScale {
					service.logger.WithFields(logrus.Fields{
						"scaler":    scalerName,
						"height":    height,
						"direction": scaleDirection,
					}).Debug("Service is scaling")
				}
			}
		}

		// TODO: Can we move this somewhere else
		// Clear the queues from any remaining work
		err = service.queue.Purge(service.collectorQueueName)
		if err != nil {
			return err
		}

		err = service.queue.Purge(service.healthCheckQueueName)
		if err != nil {
			return err
		}

		err = service.queue.Purge(service.executorQueueName)
		if err != nil {
			return err
		}

		// Send out new work for the collector in batches of collectorItemsPerPacket
		var offset uint64
		for i := uint64(0); i <= service.collectorTotalContractItems; i += uint64(service.collectorItemsPerPacket) {
			offset = i
			limit := service.collectorItemsPerPacket

			workItem := types.WorkItem{
				RPCEndpoint:        service.rpcEndpoint,
				HiveEndpoint:       service.hiveEndpoint,
				LCDEndpoint:        service.lcdEndpoint,
				ContractAddress:    service.collectorContract,
				ContractItemPrefix: service.contractItemPrefix,
				WorkItemType:       service.workItemType,
				ContractPageOffset: offset,
				ContractPageLimit:  uint64(limit),
			}

			item, err := json.Marshal(workItem)
			if err != nil {
				service.logger.WithFields(logrus.Fields{
					"error":  err,
					"offset": workItem.ContractPageOffset,
					"limit":  workItem.ContractPageLimit,
				}).Error("Unable to marshal collector work item")
				continue
			}

			err = service.queue.Push(service.collectorQueueName, item)
			if err != nil {
				service.logger.WithFields(logrus.Fields{
					"error":  err,
					"offset": workItem.ContractPageOffset,
					"limit":  workItem.ContractPageLimit,
				}).Error("Unable to push work to collector queue")
				continue
			}

			service.logger.WithFields(logrus.Fields{
				"offset": workItem.ContractPageOffset,
				"limit":  workItem.ContractPageLimit,
			}).Info("Submitted work to collector queue")
		}

		service.logger.WithFields(logrus.Fields{
			"height":     height,
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

		// Store the total amount of items
		service.metricsCache.Set(
			"collector.contract_items.total",
			float64(stateResponse.Pagination.Total),
		)
		service.collectorTotalContractItems = stateResponse.Pagination.Total

		service.logger.WithFields(logrus.Fields{
			"metric_key": "contract_state_count",
			"total":      stateResponse.Pagination.Total,
			"elapsed_ms": time.Since(start).Milliseconds(),
		}).Info("Fetched contract items")

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
