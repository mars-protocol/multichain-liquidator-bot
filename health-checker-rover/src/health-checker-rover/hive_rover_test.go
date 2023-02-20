package health_checker_rover

import (
	"fmt"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/types"
	"testing"
)

func Test_weCanQueryAccounts(t *testing.T) {

	hiveEndpoint := "https://osmosis-delphi-testnet-1.simply-vc.com.mt/XF32UOOU55CX/osmosis-hive/graphql"
	creditManagerAddress := "osmo12lf593ekns80tyv9v5qqr2yhu070zrgwkkd8hqrn0eg9nl9yp27qv7djff"
	batchSize := 200

	mockPosition := types.RoverHealthCheckWorkItem{
		AccountId: "25",
	}

	positions := []types.RoverHealthCheckWorkItem{}

	for i := 1; i <= batchSize; i++ {
		positions = append(positions, mockPosition)
	}

	hiveRover := RoverHive{hiveEndpoint}

	result, err := hiveRover.FetchBatch(creditManagerAddress, positions)

	if err != nil {
		t.Errorf("Error occured during request: %s", err)
	}

	expectedLength := len(positions)
	actualLength := len(result)
	if expectedLength != actualLength {
		t.Errorf("Length was incorrect. Expected %d but got %d", expectedLength, actualLength)
	}

	liquidatable := result[0].ContractQuery.Health.Liquidatable
	fmt.Printf("liquidatable: %t", liquidatable)
}
