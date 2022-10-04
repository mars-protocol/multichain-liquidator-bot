package health_checker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/types"
	"github.com/sirupsen/logrus"
)

type HealthChecker struct {
	queue                interfaces.Queuer
	metricsCache         interfaces.Cacher
	hive                 Hive
	healthCheckQueueName string
	liquidationQueueName string
	jobsPerWorker        int
	addressesPerJob      int
	redbankAddress       string

	batchSize       int
	logger          *logrus.Entry
	continueRunning uint32
}

var (
	errDefault = errors.New("wrong argument type")
)

func New(
	queue interfaces.Queuer,
	metricsCache interfaces.Cacher,
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

	if metricsCache == nil {
		return nil, errors.New("metricsCache must be set")
	}

	if liquidationQueueName == "" || healthCheckQueueName == "" {
		return nil, errors.New("HealthCheckQueue and liquidationQueue must be set")
	}

	if addressesPerJob == 0 {

		return nil, errors.New("AddressesPerJob cannot be 0")
	}

	return &HealthChecker{
		queue:                queue,
		metricsCache:         metricsCache,
		healthCheckQueueName: healthCheckQueueName,
		liquidationQueueName: liquidationQueueName,
		jobsPerWorker:        jobsPerWorker,
		batchSize:            batchSize,
		addressesPerJob:      addressesPerJob,
		redbankAddress:       redbankAddress,
		logger:               logger,
		batchSize:            batchSize,
		addressesPerJob:      addressesPerJob,
		continueRunning:      0,
	}, nil
}

// Generate an execute function for our Jobs
func (s *HealthChecker) getExecuteFunction(redbankAddress string) func(ctx context.Context, args interface{}) (interface{}, error) {
	execute := func(
		ctx context.Context,
		args interface{}) (interface{}, error) {
		positions, ok := args.([]types.HealthCheckWorkItem)
		if !ok {
			s.logger.Error("Failed to load positions")
			return nil, errDefault
		}

		batchResults, err := s.hive.FetchBatch(redbankAddress, positions)

		if err != nil {
			return nil, err
		}

		return batchResults, err
	}

	return execute
}

// Generate a list of jobs. Each job represents a batch of requests for N number
// of address health status'
func (s *HealthChecker) generateJobs(positionList []types.HealthCheckWorkItem, addressesPerJob int) []Job {

	numberOfAddresses := len(positionList)
	jobs := []Job{}
	// Slice our address into jobs, each job fetching N number of addresses
	for i := 0; i < len(positionList); i += addressesPerJob {
		remainingAddresses := float64(numberOfAddresses - i)
		maxAddresses := float64(addressesPerJob)
		sliceEnd := i + int(math.Min(remainingAddresses, maxAddresses))

		positionsSubSlice := positionList[i:sliceEnd]

		if len(positionsSubSlice) > 0 {

			// insert job
			jobs = append(jobs, Job{
				Descriptor: JobDescriptor{
					ID:       JobID(fmt.Sprintf("%v", i)),
					JType:    "HealthStatusBatch",
					Metadata: nil,
				},
				ExecFn: s.getExecuteFunction(s.redbankAddress),
				Args:   positionsSubSlice,
			})
		}
	}
	return jobs
}

// Filter unhealthy positions into array of byte arrays.
// TODO handle different liquidation types (e.g redbank, rover). Currently we only store address
func (s *HealthChecker) produceUnhealthyPositions(results []UserResult) [][]byte {
	var unhealthyPositions [][]byte
	for _, userResult := range results {
		ltv, err := strconv.ParseFloat(userResult.ContractQuery.HealthStatus.Borrowing, 32)
		if err != nil {
			s.logger.Errorf("An Error Occurred decoding health status. %v", err)
		} else if ltv < 1 {

			positionDecoded, decodeError := json.Marshal(userResult)
			if decodeError == nil {
				unhealthyPositions = append(unhealthyPositions, positionDecoded)
			} else {
				s.logger.Errorf("An Error Occurred decoding user address. %v", err)
			}
		}
	}

	return unhealthyPositions
}

// Runs until interrupted
func (s *HealthChecker) Run() error {
	err := s.queue.Connect()
	if err != nil {
		return err
	}

	// cleanup
	defer s.queue.Disconnect()

	// Set long running to run
	atomic.StoreUint32(&s.continueRunning, 1)

	for atomic.LoadUint32(&s.continueRunning) == 1 {
		s.logger.WithFields(logrus.Fields{
			"queue":      s.healthCheckQueueName,
			"batch_size": s.batchSize,
		}).Debug("Fetching items from Redis")

		// The queue will return a nil item but no error when no items were in the queue

		items, err := s.queue.FetchMany(s.healthCheckQueueName, s.batchSize)
		if err != nil {
			return err
		}

		if items == nil {
			s.logger.Info("no items yet")
			// No items yet, sleep to prevent spam of fetch many
			time.Sleep(500 * time.Millisecond)
			continue
		}

		s.logger.WithFields(logrus.Fields{
			"count": len(items),
		}).Debug("Fetched items from Redis")

		start := time.Now()

		var positions []types.HealthCheckWorkItem
		for _, item := range items {
			var position types.HealthCheckWorkItem
			err = json.Unmarshal(item, &position)
			if err != nil {
				s.logger.Error(err)
				continue // To next position
			}
			positions = append(positions, position)
		}

		if err != nil {
			s.logger.Error(err)
			return err
		}

		// Dispatch workers to fetch position statuses
		jobs := s.generateJobs(positions, s.addressesPerJob)
		userResults, success := s.RunWorkerPool(jobs)
		s.metricsCache.IncrementBy("health_checker.accounts.scanned", int64(len(userResults)))

		// A warning incase we do not successfully load data for all positions.
		// This will likely not occur but it it does is important we notice.
		if len(userResults) < len(positions) {
			s.logger.WithFields(logrus.Fields{
				"missed": len(positions) - len(userResults),
			}).Warn("Failed to load all positions")
		}

		if !success {
			s.logger.Errorf("Worker pool execution returned false. ")
		}

		unhealthyPositions := s.produceUnhealthyPositions(userResults)

		if len(unhealthyPositions) > 0 {

			// Log the amount of liquidations to be performed
			s.metricsCache.IncrementBy("executor.liquidations.total", int64(len(unhealthyPositions)))
			err := s.queue.PushMany(s.liquidationQueueName, unhealthyPositions)
			if err != nil {
				s.logger.Errorf("Failed to push unhealthy addresses to queue. Error : %v", err)
			}

			s.logger.WithFields(logrus.Fields{
				"total": len(unhealthyPositions),
			}).Info("Found unhealthy positions")
		}
		// Log the total amount of unhealthy positions
		s.metricsCache.IncrementBy("health_checker.unhealthy.total", int64(len(unhealthyPositions)))

		s.logger.WithFields(logrus.Fields{
			"total":      len(positions),
			"elapsed_ms": time.Since(start).Milliseconds(),
		}).Debug("Fetched contract items")

	}

	return nil
}

func (s *HealthChecker) RunWorkerPool(jobs []Job) ([]UserResult, bool) {
	wp := InitiatePool(s.jobsPerWorker)

	// prevent unneccesary work
	ctx, cancel := context.WithCancel(context.TODO())
	defer cancel()

	// Run
	go wp.GenerateFrom(jobs)
	go wp.Run(ctx)

	results := []UserResult{}

	// Iterate, pushing results into results list until we are done
	for {
		select {
		case r, ok := <-wp.Results():

			if !ok {
				fmt.Println(fmt.Errorf("An unknown error occurred fetching data."))
				continue
			}

			if r.Err != nil {
				s.logger.WithFields(logrus.Fields{
					"error": r.Err,
				}).Error("Unable to fetch data")
				continue
			}

			_, err := strconv.ParseInt(string(r.Descriptor.ID), 10, 64)
			if err != nil {
				fmt.Println(fmt.Errorf("unexpected error: %v", err))
				return results, false
			}

			val := r.Value.([]UserResult)
			results = append(results, val...)
		case <-wp.Done:
			// We return totalPositionsFetched to verify we found all addresses
			return results, true
		default:
		}
	}
}

// Stop the service gracefully
func (s *HealthChecker) Stop() error {
	// Block long running routines from continuing
	atomic.StoreUint32(&s.continueRunning, 0)
	s.logger.Info("Stopping")
	return nil
}
