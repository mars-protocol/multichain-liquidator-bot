package health_checker

import (
	"testing"
)

func Test_WeCanGenerateAndRunJobs(t *testing.T) {

	addressesPerJob := 100
	workerCount := 10
	hiveEndpoint := "https://osmosis-testnet-hive.herokuapp.com/graphql"
	redbankAddress := "osmo1mx2redehm4dtmwkfq3399k8ly2skfyqzfzg9clelw4enuuhtfeeq3dk9kj"
	batchSize := 200
	addresses := []string{"osmo18nm43hck80s2et26g2csvltecvhk49526dugd9"}
	numberOfAddresses := 200

	for i := 1; i < numberOfAddresses; i++ {
		addresses = append(addresses, "osmo18nm43hck80s2et26g2csvltecvhk49526dugd9")
	}

	service := HealthChecker{
		hiveEndpoint:    hiveEndpoint,
		redbankAddress:  redbankAddress,
		addressesPerJob: addressesPerJob,
		batchSize:       batchSize,
	}
	jobs := service.generateJobs(addresses, addressesPerJob)
	positionCount, positionBatchResults := service.RunWorkerPool(workerCount, jobs)

	if positionCount != numberOfAddresses {
		t.Error("Position count is incorrect")
	}

	if len(positionBatchResults) != numberOfAddresses/addressesPerJob {
		t.Error("Incorrect number of batches")
	}
}
