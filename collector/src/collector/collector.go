package collector

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/sirupsen/logrus"
	lens "github.com/strangelove-ventures/lens/client"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/types"
)

// Collector implements the collection of accounts by querying the contract's
// underlying storage directly
type Collector struct {
	queue                interfaces.Queuer
	metricsCache         interfaces.Cacher
	collectorQueueName   string
	healthCheckQueueName string

	logger *logrus.Entry

	continueRunning uint32
}

// New creates a new instance of the collector and returns it and an error
// when applicable
func New(
	queue interfaces.Queuer,
	metricsCache interfaces.Cacher,
	collectorQueueName string,
	healthCheckQueueName string,
	logger *logrus.Entry,
) (*Collector, error) {

	if queue == nil {
		return nil, errors.New("queue must be set")
	}

	if metricsCache == nil {
		return nil, errors.New("metricsCache must be set")
	}

	if collectorQueueName == "" || healthCheckQueueName == "" {
		return nil, errors.New("collectorQueueName and healthCheckQueueName must not be blank")
	}

	return &Collector{
		queue:                queue,
		metricsCache:         metricsCache,
		collectorQueueName:   collectorQueueName,
		healthCheckQueueName: healthCheckQueueName,
		logger:               logger,
		continueRunning:      0,
	}, nil
}

// Run the service forever
func (service *Collector) Run() error {
	// Ensure we are connected to the queue
	err := service.queue.Connect()
	if err != nil {
		return err
	}
	defer service.queue.Disconnect()

	// Set long running to run
	atomic.StoreUint32(&service.continueRunning, 1)

	// When a new block becomes available the monitor service will hand out
	// work items containing the parameters for querying the contract state
	for atomic.LoadUint32(&service.continueRunning) == 1 {

		// The queue will return a nil item but no error when no items are in
		// the queue. Fetch blocks for a few seconds while waiting for an item to
		// bocome available
		item, err := service.queue.Fetch(service.collectorQueueName)
		if err != nil {
			return err
		}

		if item == nil {
			// No items yet, continue
			// Because queue.Fetch blocks for a few seconds while waiting for
			// an item this continue doesn't cause the service to eat up all
			// available CPU resources
			continue
		}

		start := time.Now()
		var workItem types.WorkItem
		err = json.Unmarshal(item, &workItem)
		if err != nil {
			service.logger.Error(err)
			return err
		}

		// Once we receive a piece of work to execute we need to query the
		// contract's state and return the addresses contained for the
		// given prefix
		addresses, scanned, err := service.fetchContractItems(
			workItem.ContractAddress,
			workItem.RPCEndpoint,
			workItem.ContractItemPrefix,
			workItem.ContractPageOffset,
			workItem.ContractPageLimit,
		)
		if err != nil {
			return err
		}

		service.metricsCache.IncrementBy("collector.contract_items.scanned", scanned)
		service.metricsCache.IncrementBy("health_checker.accounts.total", int64(len(addresses)))

		// TODO Enrich the packet sent to the health check service
		// to include endpoints / etc
		// This will be updated as work on the health checker and liquidator
		// progresses

		// Push addresses to Redis
		// SAMPLE PACKET
		// {
		// 	"address": "osmo1...",
		// 	"debts": [
		// 		{
		// 			"token": "uosmo",
		// 			"amount": 100000
		// 		},
		// 		{
		// 			"token": "ibc/SAMPLEIBCHASH",
		// 			"amount": 5000
		// 		}
		// 	],
		// 	"collateral": [
		// 		{
		// 			"token": "uosmo",
		// 			"amount": 200000
		// 		},
		// 		{
		// 			"token": "uother",
		// 			"amount": 12000
		// 		}
		// 	],
		// 	"endpoints": {
		// 		"hive": "https://example.com/graphql",
		// 		"lcd": "https://lcd.example.com",
		// 		"rpc": "https://rpc.example.com"
		// 	}
		// }
		service.queue.PushMany(service.healthCheckQueueName, addresses)

		service.logger.WithFields(logrus.Fields{
			"total":      len(addresses),
			"elapsed_ms": time.Since(start).Milliseconds(),
		}).Info("Pushed addresses to Redis")
	}

	return nil
}

// fetchContractItems retrieves a maximum of limit items from the contract
// state starting at the given offset from contractAddress
func (service *Collector) fetchContractItems(
	contractAddress string,
	rpcEndpoint string,
	prefix string,
	offset uint64,
	limit uint64) ([][]byte, int64, error) {

	start := time.Now()
	var addresses [][]byte
	var totalScanned int64

	// Blocks are usually less than 6 seconds, we give ourselves an absolute
	// maximum of 5 seconds to get the information. Ideally, it should be faster
	client, err := lens.NewRPCClient(rpcEndpoint, time.Second*5)
	if err != nil {
		return addresses, totalScanned, err
	}

	var stateRequest QueryAllContractStateRequest
	stateRequest.Address = contractAddress
	stateRequest.Pagination = &PageRequest{
		Offset: offset,
		Limit:  limit,
	}

	// The structure of the request requires the query parameters to be passed
	// as protobuf encoded content
	rpcRequest, err := proto.Marshal(&stateRequest)
	if err != nil {
		return addresses, totalScanned, err
	}

	rpcResponse, err := client.ABCIQuery(
		context.Background(),
		// RPC query path for the raw state
		"/cosmwasm.wasm.v1.Query/AllContractState",
		rpcRequest,
	)
	if err != nil {
		return addresses, totalScanned, err
	}

	// The value in the response also contains the contract state in
	// protobuf encoded format
	var stateResponse QueryAllContractStateResponse
	err = proto.Unmarshal(rpcResponse.Response.GetValue(), &stateResponse)
	if err != nil {
		return addresses, totalScanned, err
	}

	// Structure of raw state we are querying
	// If a contract has a cw-storage-plus Map "balances" then the raw
	// state keys for that Map will have "balances" as a prefix. Here we need
	// to filter out all the keys we're interested in by looking for the
	// prefix
	// Example: A contract Map "balances" containing MARS addresses as keys
	// will have contract state keys returned as "balancesmars..."
	for _, model := range stateResponse.Models {
		key, err := hex.DecodeString(model.Key.String())
		if err != nil {
			return addresses, totalScanned, err
		}
		// TODO: The first two bytes indicate the length of the key
		// TODO: Parse correctly instead of doing cleanBytes
		// The result from the raw contract state includes some null / other
		// bytes used within cw-storage-plus, we can strip them out
		// to get a usable key for our purposes
		keyString := cleanBytes(key)

		// Only capture those with the correct prefix
		if strings.HasPrefix(keyString, prefix) {
			address := strings.TrimPrefix(keyString, prefix)

			// TODO: Depending on the final contract Map key structure, we might
			// need to do some additional processing of the address here
			addresses = append(addresses, []byte(address))
		}
		totalScanned++
	}
	service.logger.WithFields(logrus.Fields{
		"total":      len(addresses),
		"elapsed_ms": time.Since(start).Milliseconds(),
	}).Debug("Fetched contract items")
	return addresses, totalScanned, nil
}

// Stop the service gracefully
func (service *Collector) Stop() error {
	// Block long running routines from continuing
	atomic.StoreUint32(&service.continueRunning, 0)
	return nil
}
