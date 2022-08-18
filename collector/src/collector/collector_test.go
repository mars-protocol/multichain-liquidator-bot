package collector

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime/mock"
	"github.com/sirupsen/logrus"
)

func TestNewNoQueue(t *testing.T) {
	logger := logrus.WithFields(logrus.Fields{})
	_, err := New(nil, "", "", logger)
	if err == nil {
		t.Errorf("expected failure to create Collector due to missing queues")
	}
}

func TestNew(t *testing.T) {
	logger := logrus.WithFields(logrus.Fields{})
	queue, err := mock.NewRedis()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	_, err = New(queue, "collector", "health_check", logger)
	if err != nil {
		t.Errorf("unexpected failure to create Collector: %s", err)
	}
}

func TestRPCFetch(t *testing.T) {
	logger := logrus.WithFields(logrus.Fields{})
	queue, err := mock.NewRedis()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	instance, err := New(queue, "collector", "health_check", logger)
	if err != nil {
		t.Errorf("unexpected failure to create Collector: %s", err)
	}

	rpcServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// RPC sample response containing 10 balance records is returned for any request
		testResponse := `{"jsonrpc": "2.0","id": 0,"result": {"response": {"code": 0,"log": "","info": "","index": "0","key": null,"value": "CjwKNQAHYmFsYW5jZXRlcnJhMTAwNXIydTM1bXJ3OXpxdm43ajVkM3gwNGdxNmNhcDIzMmtqd3V3EgMiMCIKRAo1AAdiYWxhbmNldGVycmExMDA1enk1Njljc2NjaDZxbDZmeDhyNWRnbnNuMHQ2ZTlmbTYweDYSCyIxNzg1NTQ0NTYiCkQKNQAHYmFsYW5jZXRlcnJhMTAwNzc2d3lzNWNyMGxjd25xM2hyajVnNjZlOG02eW5hMGdjMHlxEgsiMjUyMDg1NjM3Igo8CjUAB2JhbGFuY2V0ZXJyYTEwMGVjZjRhMzZoYW1wNDdhYThtNTgwN3RtdGh5YXB1dnozMGprahIDIjAiCkMKNQAHYmFsYW5jZXRlcnJhMTAwZXFnN3MyM3Z5ampyZ3A5NHd1ZWozdnhnZGEzcDI1djl3aHRxEgoiMjYxMTMyNDciCkMKNQAHYmFsYW5jZXRlcnJhMTAwanN1eXFkbnRwNnp6djlleDJ1d2xrYTRtbW1uZ3Y5a3o2Z2V1EgoiMjUxMTM5MjgiCjwKNQAHYmFsYW5jZXRlcnJhMTAwcGVzcHB2eTR1dHN2YWx3eHFsbWZybTY4cnYwcWVrMnBhanN3EgMiMCIKQwo1AAdiYWxhbmNldGVycmExMDB3c3M3azlkd3F2ZG40d2RlbDY1aDV1c3BybTNnYWpudTdobDgSCiIxMDgwNDY4MiIKQgo1AAdiYWxhbmNldGVycmExMDI1OTllOGxwazg2NTJla2xocW1reW5yOXB0OXZ6NWM2c3BrcjgSCSIyNDc3ODMwIgpDCjUAB2JhbGFuY2V0ZXJyYTEwMjZoYzV6ajNqcnN4aHpjMjA2Z2VrNmN0aHBnY3JlNnowZW5uNRIKIjQ5OTk5MTc5IhI3CjUAB2JhbGFuY2V0ZXJyYTEwMjZud3J5aGh3c2ZrY3E5czJsNDJranF2dnV3eGNtYTcyazBjbA==","proofOps": null,"height": "1180475","codespace": ""}}}`
		w.Write([]byte(testResponse))
	}))

	items, err := instance.fetchContractItems(
		"testContractAddress",
		rpcServer.URL,
		"balance",
		0,
		10,
	)

	if err != nil {
		t.Errorf("unable to fetch contract items: %s", err)
	}

	// We expect 10 items to be returned by the fetch of contract state
	expectedItemCount := 10
	actualItemCount := len(items)
	if actualItemCount != expectedItemCount {
		t.Errorf(
			"returned item counts doesn't match expected. Expected %d, got %d",
			expectedItemCount,
			actualItemCount,
		)
	}
}

func TestRPCFetchIncorrectPrefix(t *testing.T) {
	logger := logrus.WithFields(logrus.Fields{})
	queue, err := mock.NewRedis()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	instance, err := New(queue, "collector", "health_check", logger)
	if err != nil {
		t.Errorf("unexpected failure to create Collector: %s", err)
	}

	rpcServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// RPC sample response containing 10 balance records is returned for any request
		testResponse := `{"jsonrpc": "2.0","id": 0,"result": {"response": {"code": 0,"log": "","info": "","index": "0","key": null,"value": "CjwKNQAHYmFsYW5jZXRlcnJhMTAwNXIydTM1bXJ3OXpxdm43ajVkM3gwNGdxNmNhcDIzMmtqd3V3EgMiMCIKRAo1AAdiYWxhbmNldGVycmExMDA1enk1Njljc2NjaDZxbDZmeDhyNWRnbnNuMHQ2ZTlmbTYweDYSCyIxNzg1NTQ0NTYiCkQKNQAHYmFsYW5jZXRlcnJhMTAwNzc2d3lzNWNyMGxjd25xM2hyajVnNjZlOG02eW5hMGdjMHlxEgsiMjUyMDg1NjM3Igo8CjUAB2JhbGFuY2V0ZXJyYTEwMGVjZjRhMzZoYW1wNDdhYThtNTgwN3RtdGh5YXB1dnozMGprahIDIjAiCkMKNQAHYmFsYW5jZXRlcnJhMTAwZXFnN3MyM3Z5ampyZ3A5NHd1ZWozdnhnZGEzcDI1djl3aHRxEgoiMjYxMTMyNDciCkMKNQAHYmFsYW5jZXRlcnJhMTAwanN1eXFkbnRwNnp6djlleDJ1d2xrYTRtbW1uZ3Y5a3o2Z2V1EgoiMjUxMTM5MjgiCjwKNQAHYmFsYW5jZXRlcnJhMTAwcGVzcHB2eTR1dHN2YWx3eHFsbWZybTY4cnYwcWVrMnBhanN3EgMiMCIKQwo1AAdiYWxhbmNldGVycmExMDB3c3M3azlkd3F2ZG40d2RlbDY1aDV1c3BybTNnYWpudTdobDgSCiIxMDgwNDY4MiIKQgo1AAdiYWxhbmNldGVycmExMDI1OTllOGxwazg2NTJla2xocW1reW5yOXB0OXZ6NWM2c3BrcjgSCSIyNDc3ODMwIgpDCjUAB2JhbGFuY2V0ZXJyYTEwMjZoYzV6ajNqcnN4aHpjMjA2Z2VrNmN0aHBnY3JlNnowZW5uNRIKIjQ5OTk5MTc5IhI3CjUAB2JhbGFuY2V0ZXJyYTEwMjZud3J5aGh3c2ZrY3E5czJsNDJranF2dnV3eGNtYTcyazBjbA==","proofOps": null,"height": "1180475","codespace": ""}}}`
		w.Write([]byte(testResponse))
	}))

	items, err := instance.fetchContractItems(
		"testContractAddress",
		rpcServer.URL,
		"incorrectprefix",
		0,
		10,
	)

	if err != nil {
		t.Errorf("unable to fetch contract items: %s", err)
	}

	// We expect 0 items to be returned by the fetch of contract state due to the
	// incorrect prefix to search for
	expectedItemCount := 0
	actualItemCount := len(items)
	if actualItemCount != expectedItemCount {
		t.Errorf(
			"returned item counts doesn't match expected. Expected %d, got %d",
			expectedItemCount,
			actualItemCount,
		)
	}
}
