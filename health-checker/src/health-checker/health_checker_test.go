package health_checker

import (
	"testing"
)

var (
	addressesPerJob   = 100
	hiveEndpoint      = "https://osmosis-testnet-hive.herokuapp.com/graphql" //todo mock me
	redbankAddress    = "osmo1mx2redehm4dtmwkfq3399k8ly2skfyqzfzg9clelw4enuuhtfeeq3dk9kj"
	numberOfAddresses = 200

	addresses = []string{"osmo18nm43hck80s2et26g2csvltecvhk49526dugd9"}
)

func initService() HealthChecker {

	batchSize := 200

	hive := Hive{hiveEndpoint}
	service := HealthChecker{
		hive:            hive,
		redbankAddress:  redbankAddress,
		addressesPerJob: addressesPerJob,
		batchSize:       batchSize,
	}

	return service
}

func TestWeCanGenerateAndRunJobs(t *testing.T) {
	numberOfAddresses := 200

	addresses := []string{"osmo18nm43hck80s2et26g2csvltecvhk49526dugd9"}
	for i := 1; i < numberOfAddresses; i++ {
		addresses = append(addresses, "osmo18nm43hck80s2et26g2csvltecvhk49526dugd9")
	}

	service := initService()

	jobs := service.generateJobs(addresses, service.addressesPerJob)
	userResults, success := service.RunWorkerPool(jobs)

	if !success {
		t.Error("Unknown error occurred during processing of jobs")
	}

	if len(userResults) != len(addresses) {
		t.Errorf("Incorrect number of batches, found %d but expected %d", len(userResults), len(addresses))
	}
}

func TestCanFilterUnhealthyPositions(t *testing.T) {
	dataA :=
		ContractQuery{
			TotalCollateralInBaseAsset: "100",
			TotalDebtInBaseAsset:       "100",
			HealthStatus:               HealthStatus{Borrowing: "0.99"}}

	dataB :=
		ContractQuery{
			TotalCollateralInBaseAsset: "100",
			TotalDebtInBaseAsset:       "100",
			HealthStatus:               HealthStatus{Borrowing: "1.01"},
		}

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

	unhealthy := service.produceUnhealthyAddresses(results)

	if len(unhealthy) != 1 {
		t.Fatalf("Expected 1 unhealthy position, found %d", len(unhealthy))
	}

}
