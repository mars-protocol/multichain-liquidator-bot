package collector

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"sync/atomic"
	"time"

	"github.com/cosmos/cosmos-sdk/types/query"
	"github.com/gogo/protobuf/proto"
	"github.com/sirupsen/logrus"

	"github.com/mars-protocol/multichain-liquidator-bot/collector/src/collector/prototypes"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"

	lens "github.com/strangelove-ventures/lens/client"
)

// Collector implements the collection of accounts logic
type Collector struct {
	collectorQueue   interfaces.Queuer
	healthCheckQueue interfaces.Queuer

	logger *logrus.Entry

	continueRunning uint32
}

// New creates a new instance of the collector
func New(
	collectorQueue interfaces.Queuer,
	healthCheckQueue interfaces.Queuer,
	logger *logrus.Entry,
) (*Collector, error) {

	if collectorQueue == nil || healthCheckQueue == nil {
		return nil, errors.New("newBlockQueue and healthCheckQueue must be set")
	}

	return &Collector{
		collectorQueue:   collectorQueue,
		healthCheckQueue: healthCheckQueue,
		logger:           logger,
		continueRunning:  0,
	}, nil
}

// Run the service forever
func (service *Collector) Run() error {
	err := service.collectorQueue.Connect()
	if err != nil {
		return err
	}
	defer service.collectorQueue.Disconnect()

	err = service.healthCheckQueue.Connect()
	if err != nil {
		return err
	}
	defer service.healthCheckQueue.Disconnect()

	// Set long running to run
	atomic.StoreUint32(&service.continueRunning, 1)

	// When a new block becomes available the monitor service will hand out
	// work items containing the parameters for querying the contract state
	for atomic.LoadUint32(&service.continueRunning) == 1 {

		// The queue will return a nil item but no error when no items were in
		// the queue
		item, err := service.collectorQueue.Fetch()
		if err != nil {
			return err
		}

		if item == nil {
			// No items yet
			continue
		}

		start := time.Now()
		var workItem WorkItem
		err = json.Unmarshal(item, &workItem)
		if err != nil {
			service.logger.Error(err)
			return err
		}

		// Once a new block is available we need to query the contract's state
		// and return the addresses contained in the given prefix.
		addresses, err := service.fetchContractItems(
			workItem.ContractAddress,
			workItem.RPCAddress,
			workItem.ContractItemPrefix,
			workItem.ContractPageOffset,
			workItem.ContractPageLimit,
		)
		if err != nil {
			return err
		}

		// TODO Enrich the packet sent to the health check service
		// to include endpoints / etc

		// Push addresses to Redis in batches of X
		addressChunks := chunkSlice(addresses, 50)
		for _, addressChunk := range addressChunks {
			service.healthCheckQueue.PushMany(addressChunk)
		}
		service.logger.WithFields(logrus.Fields{
			"total":      len(addresses),
			"elapsed_ms": time.Since(start).Milliseconds(),
		}).Info("Pushed addresses to Redis")
	}

	return nil
}

// fetchContractItems retrieves a maximum of limit items from the contract
// state starting at the given offset from contract
func (service *Collector) fetchContractItems(
	contractAddress string,
	endpoint string,
	prefix string,
	offset uint64,
	limit uint64) ([][]byte, error) {

	start := time.Now()

	var addresses [][]byte

	// Blocks are usually less than 6 seconds, we give ourselves 5 seconds
	// to get the information. Ideally, it should be faster
	client, err := lens.NewRPCClient(endpoint, time.Second*5)
	if err != nil {
		return addresses, err
	}

	var stateRequest prototypes.QueryAllContractStateRequest
	stateRequest.Address = contractAddress
	stateRequest.Pagination = &query.PageRequest{
		Offset: offset,
		Limit:  limit,
	}
	// The structure of the request requires the query parameters to be passed
	// as protobuf encoded content
	rpcRequest, err := proto.Marshal(&stateRequest)
	if err != nil {
		return addresses, err
	}

	rpcResponse, err := client.ABCIQuery(
		context.Background(),
		"/cosmwasm.wasm.v1.Query/AllContractState",
		rpcRequest,
	)
	if err != nil {
		return addresses, err
	}

	// The value in the response also contains the contract state in
	// protobuf encoded format
	var stateResponse prototypes.QueryAllContractStateResponse
	err = proto.Unmarshal(rpcResponse.Response.GetValue(), &stateResponse)
	if err != nil {
		return addresses, err
	}

	// If a contract has a cw-storage-plus Map "balances" then the raw
	// state keys for that Map will have "balances" as a prefix. Here we need
	// to filter out all the keys we're interested in by looking for the
	// prefix
	// Example: A contract Map "balances" containing MARS addresses as keys
	// will have contract state keys returned as "balancesmars..."
	for _, model := range stateResponse.Models {
		key, err := hex.DecodeString(model.Key.String())
		if err != nil {
			return addresses, err
		}
		// The result from the raw contract state includes some non-alphanumeric
		// values used within cw-storage-plus, we can strip them out
		// to get a usable key value for our purposes
		keyString := cleanBytes(key)

		// Only capture those with the correct prefix
		if strings.HasPrefix(keyString, prefix) {
			address := strings.TrimPrefix(keyString, prefix)

			// TODO: Depending on the final contract Map key structure, we might
			// need to do some additional processing of the address here
			addresses = append(addresses, []byte(address))
		}
	}
	service.logger.WithFields(logrus.Fields{
		"total":      len(addresses),
		"elapsed_ms": time.Since(start).Milliseconds(),
	}).Debug("Fetched contract items")
	return addresses, nil
}

// TODO: Move this to Redis to automatically split the slice into smaller
// parts
// chunkSlice takes a slide of byte arrays and splits them into
// groups of chunkSize
func chunkSlice(slice [][]byte, chunkSize int) [][][]byte {
	var chunks [][][]byte
	for {
		if len(slice) == 0 {
			break
		}

		// necessary check to avoid slicing beyond
		// slice capacity
		if len(slice) < chunkSize {
			chunkSize = len(slice)
		}

		chunks = append(chunks, slice[0:chunkSize])
		slice = slice[chunkSize:]
	}
	return chunks
}

// Stop the service gracefully
func (service *Collector) Stop() error {
	// Block long running routines from continuing
	atomic.StoreUint32(&service.continueRunning, 0)
	return nil
}
