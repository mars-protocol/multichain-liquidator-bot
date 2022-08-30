package health_checker

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
	"github.com/sirupsen/logrus"
)

type HealthChecker struct {
	queue                interfaces.Queuer
	hive                 Hive
	healthCheckQueueName string
	liquidationQueueName string
	redbankAddress       string
	addressesPerJob      int
	batchSize            int
	logger               *logrus.Entry
	continueRunning      uint32
}

var (
	errDefault = errors.New("wrong argument type")
)

func New(
	queue interfaces.Queuer,
	hive Hive,
	healthCheckQueueName string,
	liquidationQueueName string,
	jobsPerWorker int,
	batchSize int,
	addressesPerJob int,
	redbankAddress string,
	logger *logrus.Entry,
) (*HealthChecker, error) {

	if queue == nil {
		return nil, errors.New("queue must be set")
	}

	if liquidationQueueName == "" || healthCheckQueueName == "" {
		return nil, errors.New("HealthCheckQueue and liquidationQueue must be set")
	}

	return &HealthChecker{
		healthCheckQueueName: healthCheckQueueName,
		liquidationQueueName: liquidationQueueName,
		logger:               logger,
		continueRunning:      0,
	}, nil
}

// Generate an execute function for our Jobs
func (s HealthChecker) getExeuteFunction(redbankAddress string) func(ctx context.Context, args interface{}) (interface{}, error) {
	execute := func(
		ctx context.Context,
		args interface{}) (interface{}, error) {
		addresses, ok := args.([]string)
		if !ok {
			return nil, errDefault
		}

		batchResults, err := s.hive.FetchBatch(redbankAddress, addresses)

		if err != nil {
			return nil, err
		}

		return batchResults, err
	}

	return execute
}

// Generate a list of jobs. Each job represents a batch of requests for N number
// of address health status'
func (s HealthChecker) generateJobs(addressList []string, addressesPerJob int) []Job {

	numberOfAddresses := len(addressList)

	jobs := []Job{}

	// Slice our address into jobs, each job fetching N number of addresses
	for i := 0; i < len(addressList); i += addressesPerJob {

		remainingAddresses := float64(numberOfAddresses - i)
		maxAddresses := float64(addressesPerJob)
		sliceEnd := i + int(math.Min(remainingAddresses, maxAddresses))

		addressSubSlice := addressList[i:sliceEnd]

		if len(addressSubSlice) > 0 {
			// insert job
			jobs = append(jobs, Job{
				Descriptor: JobDescriptor{
					ID:       JobID(fmt.Sprintf("%v", i)),
					JType:    "HealthStatusBatch",
					Metadata: nil,
				},
				ExecFn: s.getExeuteFunction(s.redbankAddress),
				Args:   addressSubSlice,
			})
		}
	}
	return jobs
}

// Filter unhealthy positions into array of byte arrays.
// TODO handle different liquidation types (e.g redbank, rover). Currently we only store address
func (s HealthChecker) produceUnhealthyAddresses(results []BatchEventsResponse) [][]byte {

	var unhealthyAddresses [][]byte
	for _, batch := range results {
		for _, position := range batch {
			i, err := strconv.ParseFloat(position.Data.Wasm.ContractQuery.HealthStatus.Borrowing, 32)
			if err != nil {
				s.logger.Errorf("An Error Occurred decoding health status. %v", err)
			} else if i < 1 {
				address, decodeError := hex.DecodeString(position.UserAddress)
				if decodeError == nil {
					unhealthyAddresses = append(unhealthyAddresses, address)
				} else {
					s.logger.Errorf("An Error Occurred decoding user address. %v", err)
				}
			}
		}
	}

	return unhealthyAddresses
}

// Runs until interrupted
func (s HealthChecker) Run() error {
	err := s.queue.Connect()
	if err != nil {
		return err
	}
	// cleanup
	defer s.queue.Disconnect()

	// Set long running to run
	atomic.StoreUint32(&s.continueRunning, 1)

	for atomic.LoadUint32(&s.continueRunning) == 1 {

		// The queue will return a nil item but no error when no items were in
		// the queue
		items, err := s.queue.FetchMany(s.healthCheckQueueName, s.batchSize)
		if err != nil {
			return err
		}

		if items == nil {
			// No items yet, sleep to prevent spam of fetch many
			time.Sleep(100 * time.Millisecond)
			continue
		}

		start := time.Now()

		var addresses []string
		for _, item := range items {
			err = json.Unmarshal(item, &addresses)
		}

		if err != nil {
			s.logger.Error(err)
			return err
		}

		// Dispatch workers to fetch position statuses
		jobs := s.generateJobs(addresses, s.addressesPerJob)
		totalPositions, results := s.RunWorkerPool(10, jobs)

		// A warning incase we do not successfully load data for all positions.
		// This will likely not occur but it it does is important we notice.
		if totalPositions < len(addresses) {
			s.logger.WithFields(logrus.Fields{
				"missed": len(addresses) - totalPositions,
			}).Warn("Failed to load all positions")
		}

		unhealthyAddresses := s.produceUnhealthyAddresses(results)

		if len(unhealthyAddresses) > 0 {

			err := s.queue.PushMany(s.liquidationQueueName, unhealthyAddresses)
			if err != nil {
				s.logger.Errorf("Failed to push unhealthy addresses to queue. Error : %v", err)
			}

			s.logger.WithFields(logrus.Fields{
				"total": len(unhealthyAddresses),
			}).Info("Found unhealthy positions")
		}

		s.logger.WithFields(logrus.Fields{
			"total":      len(addresses),
			"elapsed_ms": time.Since(start).Milliseconds(),
		}).Debug("Fetched contract items")

	}

	return nil
}

func (s HealthChecker) RunWorkerPool(workerCount int, jobs []Job) (int, []BatchEventsResponse) {
	wp := InitiatePool(workerCount)

	// prevent unneccesary work
	ctx, cancel := context.WithCancel(context.TODO())
	defer cancel()

	// Run
	go wp.GenerateFrom(jobs)
	go wp.Run(ctx)

	results := []BatchEventsResponse{}
	totalPositionsFetched := 0

	// Iterate, pushing results into results list until we are done
	for {
		select {
		case r, ok := <-wp.Results():
			if !ok {
				fmt.Println(fmt.Errorf("An unknown error occurred fetching data."))
				continue
			}

			_, err := strconv.ParseInt(string(r.Descriptor.ID), 10, 64)
			if err != nil {
				fmt.Println(fmt.Errorf("unexpected error: %v", err))
			}

			val := r.Value.(BatchEventsResponse)
			totalPositionsFetched += len(val)

			results = append(results, val)
		case <-wp.Done:
			// We return totalPositionsFetched to verify we found all addresses
			return totalPositionsFetched, results
		default:
		}
	}
}

// Stop the service gracefully
func (s *HealthChecker) Stop() error {
	// Block long running routines from continuing
	atomic.StoreUint32(&s.continueRunning, 0)
	return nil
}
