package main

import (
	"testing"
)

func Test_WeCanGenerateAndRunJobs(t *testing.T) {

	addressesPerJob := 100
	workerCount := 10
	addresses := []string{"osmo18nm43hck80s2et26g2csvltecvhk49526dugd9"}
	numberOfAddresses := 200

	for i := 1; i < numberOfAddresses; i++ {
		addresses = append(addresses, "osmo18nm43hck80s2et26g2csvltecvhk49526dugd9")
	}

	service := Service{}
	jobs := service.generateJobs(addresses, addressesPerJob)
	positionCount, positionBatchResults := service.RunWorkerPool(workerCount, jobs)

	if positionCount != numberOfAddresses {
		t.Error("Position count is incorrect")
	}

	if len(positionBatchResults) != numberOfAddresses/addressesPerJob {
		t.Error("Incorrect number of batches")
	}
}
