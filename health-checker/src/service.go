package main

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
)

type Service struct{}

func (s Service) loadDataFromRedis() {

}

var (
	// todo move these variables to environment variables

	jobsPerWorker = 10

	hiveEndpoint   = "https://osmosis-testnet-hive.herokuapp.com/graphql" //"https://osmosis-mars-frontend.simply-vc.com.mt/GGSFGSFGFG34/osmosis-hive/graphql"
	redbankAddress = "osmo1mx2redehm4dtmwkfq3399k8ly2skfyqzfzg9clelw4enuuhtfeeq3dk9kj"
	errDefault     = errors.New("wrong argument type")

	// execute batch function
	execute = func(ctx context.Context, args interface{}) (interface{}, error) {
		addresses, ok := args.([]string)
		if !ok {
			return nil, errDefault
		}

		batchResults, err := FetchBatch(hiveEndpoint, redbankAddress, addresses)

		if err != nil {
			return nil, err
		}

		return batchResults, err
	}
)

// Generate a list of jobs. Each job represents a batch request of
// of the health factor of N number of addresses
func (s Service) generateJobs(addressList []string, addressesPerJob int) []Job {

	numberOfAddresses := len(addressList)

	jobs := []Job{}
	jobIndex := 0
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
					JType:    "healthStatusBatch",
					Metadata: nil,
				},
				ExecFn: execute,
				Args:   addressSubSlice,
			})
			jobIndex += 1
		}

	}
	return jobs
}

func (s Service) RunWorkerPool(workerCount int, jobs []Job) (int, []BatchEventsResponse) {
	wp := New(workerCount)

	ctx, cancel := context.WithCancel(context.TODO())
	defer cancel() // todo learn what is this

	go wp.GenerateFrom(jobs)

	go wp.Run(ctx)

	results := []BatchEventsResponse{}
	// iterate results
	totalPositionsFetched := 0
	for {
		select {
		case r, ok := <-wp.Results():
			if !ok {
				fmt.Println(fmt.Errorf("An unkown error occurred fetching data."))
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
			return totalPositionsFetched, results
		default:
		}
	}
}
