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
	HiveEndpoint string
}

type HealthStatus struct {
	Borrowing string `json:"borrowing"`
}
type ContractQuery struct {
	TotalCollateralInBaseAsset string       `json:"total_collateral_in_base_asset"`
	TotalDebtInBaseAsset       string       `json:"total_debt_in_base_asset"`
	HealthStatus               HealthStatus `json:"health_status"`
}
type Wasm struct {
	ContractQuery ContractQuery `json:"contractQuery"`
}
type Data struct {
	Wasm Wasm `json:"wasm"`
}

type Error struct {
	Message string `json:"message"`
}

type UserPosition struct {
	UserAddress string
	Data        map[string]Wasm `json:"data"`
	Errors      []Error         `json:"errors"`
}

type UserResult struct {
	Address       string
	ContractQuery ContractQuery
	Debts         []Asset
	Collateral    []Asset
}

// BatchEventsResponse defines the format for batch position responses
type BatchEventsResponse []UserPosition

// fetchHiveEvents fetches events from Hive for the given block numbers
func (hive Hive) FetchBatch(
	contractAddress string,
	positions []Position,
) ([]UserResult, error) {

	var userResults []UserResult
	var batchEvents BatchEventsResponse
	positonMap := make(map[string]Position)

	var queries []BatchQuery
	for _, position := range positions {

		// store addresses in this local map so that we can easily add debts and collateral later
		positonMap[position.Address] = position
		batchQuery := BatchQuery{
			Query: fmt.Sprintf(`query($contractAddress: String! $userAddress: String!) {
                        %s:wasm {
							contractQuery(contractAddress: $contractAddress, query: { user_position : { user_address: $userAddress } })
						}
                    }`, position.Address),
			Variables: map[string]interface{}{
				"contractAddress": contractAddress,
				"userAddress":     position.Address,
			},
		}
		queries = append(queries, batchQuery)
	}

	queryBytes, err := json.Marshal(queries)
	if err != nil {
		fmt.Println(fmt.Errorf("An Error occurred fetching data: %v", err))
		return userResults, err
	}

	response, err := http.Post(hive.HiveEndpoint, "application/json", bytes.NewReader(queryBytes))

	if err != nil {
		return userResults, err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		return userResults, fmt.Errorf("not found %d", response.StatusCode)
	}

	err = json.NewDecoder(response.Body).Decode(&batchEvents)
	if err != nil {
		return userResults, err
	}

	for _, event := range batchEvents {
		// event.Data is now the address[contractQuery] map
		for address, data := range event.Data {

			position := positonMap[address]
			userResults = append(userResults, UserResult{
				Address:       address,
				ContractQuery: data.ContractQuery,
				Debts:         position.Debts,
				Collateral:    position.Collateral,
			})
		}
	}

	return userResults, nil
}
