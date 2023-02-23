package health_checker

import (
	"testing"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime/types"
)

var (
	addressesPerJob   = 100
	jobsPerWorker     = 10
	hiveEndpoint      = "https://osmosis-testnet-hive.herokuapp.com/graphql" //todo mock me
	redbankAddress    = "osmo1mx2redehm4dtmwkfq3399k8ly2skfyqzfzg9clelw4enuuhtfeeq3dk9kj"
	numberOfAddresses = 200
)

func initService() HealthChecker {

	batchSize := 200

	hive := Hive{hiveEndpoint}
	service := HealthChecker{
		hive:            hive,
		redbankAddress:  redbankAddress,
		jobsPerWorker:   jobsPerWorker,
		addressesPerJob: addressesPerJob,
		batchSize:       batchSize,
	}

	return service
}

func TestWeCanGenerateAndRunJobs(t *testing.T) {
	batchSize := 200
	mockPosition := types.HealthCheckWorkItem{
		Identifier: "osmo18nm43hck80s2et26g2csvltecvhk49526dugd9",
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
			TotalCollateralInBaseAsset: "100",
			TotalDebtInBaseAsset:       "100",
			HealthStatus: HealthStatus{
				Borrowing: Borrowing{
					LiquidationThresholdHf: "0.99",
				},
			},
		}

	dataB :=
		ContractQuery{
			TotalCollateralInBaseAsset: "100",
			TotalDebtInBaseAsset:       "100",
			HealthStatus: HealthStatus{
				Borrowing: Borrowing{
					LiquidationThresholdHf: "1.01",
				},
			},
		}

	// create fake positions
	results := []UserResult{
		{
			Identifier:    "aaaaaa",
			ContractQuery: dataA,
		},
		{
			Identifier:    "bbbbbb",
			ContractQuery: dataB,
		},
	}

	service := initService()

	unhealthy := service.produceUnhealthyPositions(results)

	if len(unhealthy) != 1 {
		t.Fatalf("Expected 1 unhealthy position, found %d", len(unhealthy))
	}

}
