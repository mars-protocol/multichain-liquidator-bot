package health_checker

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime/types"
)

// BatchQuery defines the format for a Hive batch query
type BatchQuery struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables"`
}

type Hive struct {
	HiveEndpoint string
}

type Borrowing struct {
	MaxLtvHf               string `json:"max_ltv_hf"`
	LiquidationThresholdHf string `json:"liq_threshold_hf"`
}

type HealthStatus struct {
	Borrowing Borrowing `json:"borrowing"`
}
type ContractQuery struct {
	TotalCollateralizedDebt string      `json:"total_collateralized_debt"`
	HealthStatus            interface{} `json:"health_status"`
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
	Identifier    string
	ContractQuery ContractQuery
}

// BatchEventsResponse defines the format for batch position responses
type BatchEventsResponse []UserPosition

// fetchHiveEvents fetches events from Hive for the given block numbers
func (hive *Hive) FetchBatch(
	contractAddress string,
	positions []types.HealthCheckWorkItem,
) ([]UserResult, error) {
	var userResults []UserResult
	var batchEvents BatchEventsResponse

	positonMap := make(map[string]types.HealthCheckWorkItem)

	var queries []BatchQuery
	for _, position := range positions {

		// store addresses in this local map so that we can easily add debts and collateral later
		positonMap[position.Identifier] = position
		batchQuery := BatchQuery{
			Query: fmt.Sprintf(`query($contractAddress: String! $userAddress: String!) {
                        %s:wasm {
							contractQuery(contractAddress: $contractAddress, query: { user_position : { user: $userAddress } })
						}
                    }`, position.Identifier),
			Variables: map[string]interface{}{
				"contractAddress": contractAddress,
				"userAddress":     position.Identifier,
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
		for identifier, data := range event.Data {
			userResults = append(userResults, UserResult{
				Identifier:    identifier,
				ContractQuery: data.ContractQuery,
			})
		}
	}

	return userResults, nil
}
