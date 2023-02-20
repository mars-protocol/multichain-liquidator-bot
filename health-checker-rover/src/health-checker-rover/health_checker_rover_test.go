package health_checker_rover

import (
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/types"
	"testing"
)

var (
	addressesPerJob      = 100
	jobsPerWorker        = 10
	hiveEndpoint         = "https://osmosis-testnet-hive.herokuapp.com/graphql" //todo mock me
	creditManagerAddress = "osmo1mx2redehm4dtmwkfq3399k8ly2skfyqzfzg9clelw4enuuhtfeeq3dk9kj"
	numberOfAddresses    = 200
)

func initService() HealthCheckerRover {

	batchSize := 200

	hive := RoverHive{hiveEndpoint}
	service := HealthCheckerRover{
		hive:                 hive,
		creditManagerAddress: creditManagerAddress,
		jobsPerWorker:        jobsPerWorker,
		addressesPerJob:      addressesPerJob,
		batchSize:            batchSize,
	}

	return service
}

func TestWeCanGenerateAndRunJobs(t *testing.T) {
	batchSize := 200
	mockPosition := types.HealthCheckWorkItem{
		Address:    "osmo18nm43hck80s2et26g2csvltecvhk49526dugd9",
		Debts:      []types.Asset{},
		Collateral: []types.Asset{},
	}

	positions := []types.HealthCheckWorkItem{}

	for i := 1; i <= batchSize; i++ {
		positions = append(positions, mockPosition)
	}

	service := initService()

	jobs := service.generateJobs(positions, service.addressesPerJob)

	userResults, success := service.RunWorkerPool(jobs)

	if !success {
		t.Error("Unknown error occurred during processing of jobs")
	}

	if len(userResults) != len(positions) {
		t.Errorf("Incorrect number of batches, found %d but expected %d", len(userResults), len(positions))
	}
}

func TestCanFilterUnhealthyPositions(t *testing.T) {
	dataA :=
		ContractQuery{
			Health: Health{Liquidatable: true}}

	dataB :=
		ContractQuery{
			Health: Health{Liquidatable: false}}

	// create fake positions
	results := []UserResult{
		{
			Address:       "aaaaaa",
			ContractQuery: dataA,
		},
		{
			Address:       "bbbbbb",
			ContractQuery: dataB,
		},
	}

	service := initService()

	unhealthy := service.produceUnhealthyPositions(results)

	if len(unhealthy) != 1 {
		t.Fatalf("Expected 1 unhealthy position, found %d", len(unhealthy))
	}

}
