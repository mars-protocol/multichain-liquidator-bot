package health_checker

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

type Hive struct {
	hiveEndpoint string
}

// BatchEventsResponse defines the format for batch position responses
type BatchEventsResponse []struct {
	UserAddress string
	Data        struct {
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
func (hive Hive) FetchBatch(
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
		fmt.Println(fmt.Errorf("An Error occurred fetching data: %v", err))
		return batchEvents, err
	}

	response, err := http.Post(hive.hiveEndpoint, "application/json", bytes.NewReader(queryBytes))

	if err != nil {
		return batchEvents, err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		return batchEvents, fmt.Errorf("not found %d", response.StatusCode)
	}

	err = json.NewDecoder(response.Body).Decode(&batchEvents)
	if err != nil {
		return batchEvents, err
	}

	// We need to know the user address of each position, so we append it back once the query
	// has completed. There is risk here that we get the wrong address for a position if
	// the response from the server jumbles the queries
	for index := range batchEvents {
		batchEvents[index].UserAddress = addresses[index]
	}

	return batchEvents, nil
}
