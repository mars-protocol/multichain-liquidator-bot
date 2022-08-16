package collector

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/cosmos/cosmos-sdk/types/query"
	"github.com/gogo/protobuf/proto"
	"github.com/mars-protocol/multichain-liquidator-bot/collector/src/collector/prototypes"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
	"github.com/sirupsen/logrus"

	lens "github.com/strangelove-ventures/lens/client"
)

// Collector implements the collection of accounts logic
type Collector struct {
	newBlockQueue    interfaces.Queuer
	healthCheckQueue interfaces.Queuer

	rpcEndpoint        string
	contractItemPrefix string
	contractPageOffset uint64
	contractPageLimit  uint64
	contractAddress    string

	logger *logrus.Entry

	continueRunning uint32
}

// New creates a new instance of the collector
func New(
	newBlockQueue interfaces.Queuer,
	healthCheckQueue interfaces.Queuer,
	rpcEndpoint string,
	contractItemPrefix string,
	contractPageOffset uint64,
	contractPageLimit uint64,
	contractAddress string,
	logger *logrus.Entry,
) (*Collector, error) {

	if newBlockQueue == nil || healthCheckQueue == nil {
		return nil, errors.New("newBlockQueue and healthCheckQueue must be set")
	}
	if len(rpcEndpoint) == 0 {
		return nil, errors.New("rpcEndpoint cannot be blank")
	}
	if len(contractItemPrefix) == 0 {
		return nil, errors.New("contractItemPrefix cannot be blank")
	}
	if contractPageLimit == 0 {
		return nil, errors.New("contractPageLimit must be greater then zero")
	}
	if len(contractAddress) == 0 {
		return nil, errors.New("contractAddress cannot be blank")
	}

	return &Collector{
		newBlockQueue:      newBlockQueue,
		healthCheckQueue:   healthCheckQueue,
		rpcEndpoint:        rpcEndpoint,
		contractItemPrefix: contractItemPrefix,
		contractPageOffset: contractPageOffset,
		contractPageLimit:  contractPageLimit,
		contractAddress:    contractAddress,
		logger:             logger,
		continueRunning:    0,
	}, nil
}

// Run the service forever
func (service *Collector) Run() error {
	err := service.newBlockQueue.Connect()
	if err != nil {
		return err
	}
	defer service.newBlockQueue.Disconnect()

	err = service.healthCheckQueue.Connect()
	if err != nil {
		return err
	}
	defer service.healthCheckQueue.Disconnect()

	// Set long running to run
	atomic.StoreUint32(&service.continueRunning, 1)

	// The collector listens for a new block notification via Redis
	// The monitor will notify the service when a new block is available
	for atomic.LoadUint32(&service.continueRunning) == 1 {

		// The queue will return a nil item but no error when no items were in
		// the queue
		item, err := service.newBlockQueue.Fetch()
		if err != nil {
			panic(err)
		}

		if item == nil {
			continue
		}

		// Once a new block is available we need to query the contract's state
		// and return the addresses contained in the given prefix.
		addresses, err := service.fetchContractItems(
			service.contractAddress,
			service.rpcEndpoint,
			service.contractItemPrefix,
			service.contractPageOffset,
			service.contractPageLimit,
		)
		if err != nil {
			return err
		}

		// TODO Push addresses to Redis
		fmt.Println(addresses)

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
	limit uint64) ([]string, error) {

	var addresses []string

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

		// TODO: Filter out the ones with prefix
		addresses = append(addresses, string(key))
	}
	return addresses, nil
}

// Stop the service gracefully
func (service *Collector) Stop() error {
	// Block long running routines from continuing
	atomic.StoreUint32(&service.continueRunning, 0)
	return nil
}
