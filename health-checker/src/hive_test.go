package main

import (
	"fmt"
	"testing"
)

// TODO : Do setup here, not rely on deploy scripts
func Test_weCanQueryMultipleUsers(t *testing.T) {

	hiveEndpoint := "https://osmosis-testnet-hive.herokuapp.com/graphql"
	redbankAddress := "osmo1mx2redehm4dtmwkfq3399k8ly2skfyqzfzg9clelw4enuuhtfeeq3dk9kj"
	addresses := []string{"osmo18nm43hck80s2et26g2csvltecvhk49526dugd9"}
	batchSize := 200

	for i := 1; i < batchSize; i++ {
		addresses = append(addresses, "osmo18nm43hck80s2et26g2csvltecvhk49526dugd9")
	}

	result, err := FetchBatch(hiveEndpoint, redbankAddress, addresses)

	if err != nil {
		t.Errorf("Error occured during request: %s", err)
	}

	expectedLength := len(addresses)
	actualLength := len(result)
	if expectedLength != actualLength {
		t.Errorf("Length was incorrect. Expected %d but got %d", expectedLength, actualLength)
	}
	intLTV := 0
	fmt.Sscan(result[0].Data.Wasm.ContractQuery.HealthStatus.Borrowing, &intLTV)

	if intLTV <= 0 {
		t.Errorf("Failed to correctly fetch health factor")
	}
}
