package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// BatchQuery defines the format for a Hive batch query
type BatchQuery struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables"`
}

// BatchEventsResponse defines the format for batch position responses
type BatchEventsResponse []struct {
	Data struct {
		Wasm struct {
			ContractQuery struct {
				TotalCollateralInBaseAsset string `json:"total_collateral_in_base_asset"`
				TotalDebtInBaseAsset       string `json:"total_debt_in_base_asset"`
				HealthStatus               struct {
					Borrowing string `json:"borrowing"`
				} `json:"health_status"`
			} `json:"contractQuery"`
		} `json:"wasm"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

// fetchHiveEvents fetches events from Hive for the given block numbers
func FetchBatch(
	hiveEndpoint string,
	contractAddress string,
	addresses []string,
) (BatchEventsResponse, error) {

	var batchEvents BatchEventsResponse
	// Batch all the blocknumbers into a single request
	var queries []BatchQuery
	for _, address := range addresses {
		batchQuery := BatchQuery{
			Query: `query($contractAddress: String! $userAddress: String!) {
                        wasm {
							contractQuery(contractAddress: $contractAddress, query: { user_position : { user_address: $userAddress } })
						}
                    }`,
			Variables: map[string]interface{}{
				"contractAddress": contractAddress,
				"userAddress":     address,
			},
		}
		queries = append(queries, batchQuery)
	}

	queryBytes, err := json.Marshal(queries)
	if err != nil {
		return batchEvents, err
	}

	response, err := http.Post(hiveEndpoint, "application/json", bytes.NewReader(queryBytes))
	if err != nil {
		return batchEvents, err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		return batchEvents, fmt.Errorf("not found %d", response.StatusCode)
	}

	// Parse to usable format
	err = json.NewDecoder(response.Body).Decode(&batchEvents)
	if err != nil {
		return batchEvents, err
	}

	return batchEvents, nil
}
