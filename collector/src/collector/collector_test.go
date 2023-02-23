package collector

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sirupsen/logrus"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime/mock"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/types"
)

func TestNewNoQueue(t *testing.T) {
	logger := logrus.WithFields(logrus.Fields{})
	_, err := New(nil, nil, "", "", logger)
	if err == nil {
		t.Errorf("expected failure to create Collector due to missing queues")
	}
}

func TestNew(t *testing.T) {
	logger := logrus.WithFields(logrus.Fields{})
	queue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	cache, err := mock.NewRedisCache()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	_, err = New(queue, cache, "collector", "health_check", logger)
	if err != nil {
		t.Errorf("unexpected failure to create Collector: %s", err)
	}
}

func TestRPCFetchRedbank(t *testing.T) {
	logger := logrus.WithFields(logrus.Fields{})
	queue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	cache, err := mock.NewRedisCache()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	instance, err := New(queue, cache, "collector", "health_check", logger)
	if err != nil {
		t.Errorf("unexpected failure to create Collector: %s", err)
	}

	rpcServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// RPC sample response containing 10 balance records is returned for any request
		testResponse := `{"jsonrpc": "2.0","id": 0,"result": {"response": {"code": 0,"log": "","info": "","index": "0","key": null,"value": "CnUKOAAFZGVidHMAK29zbW8xY3l5enB4cGx4ZHprZWVhN2t3c3lkYWRnODczNTdxbmFoYWtha3N1aW9uEjl7ImFtb3VudF9zY2FsZWQiOiIyOTk5OTk5NzYyMTgiLCJ1bmNvbGxhdGVyYWxpemVkIjpmYWxzZX0KtAQKDQAHbWFya2V0c3Vpb24SogR7ImRlbm9tIjoidWlvbiIsIm1heF9sb2FuX3RvX3ZhbHVlIjoiMC42NSIsImxpcXVpZGF0aW9uX3RocmVzaG9sZCI6IjAuNyIsImxpcXVpZGF0aW9uX2JvbnVzIjoiMC4xIiwicmVzZXJ2ZV9mYWN0b3IiOiIwLjIiLCJpbnRlcmVzdF9yYXRlX21vZGVsIjp7Im9wdGltYWxfdXRpbGl6YXRpb25fcmF0ZSI6IjAuMSIsImJhc2UiOiIwLjMiLCJzbG9wZV8xIjoiMC4yNSIsInNsb3BlXzIiOiIwLjMifSwiYm9ycm93X2luZGV4IjoiMS4wMDAwMDAwNzkyNzQ0ODE0NjYiLCJsaXF1aWRpdHlfaW5kZXgiOiIxIiwiYm9ycm93X3JhdGUiOiIwLjYxNjY2NjY2NjY2NjY2NjY2NiIsImxpcXVpZGl0eV9yYXRlIjoiMC4xNDc5OTk5OTk5OTk5OTk5OTkiLCJpbmRleGVzX2xhc3RfdXBkYXRlZCI6MTY2NDMwODIxOCwiY29sbGF0ZXJhbF90b3RhbF9zY2FsZWQiOiIxMDAwMDAwMDAwMDAwIiwiZGVidF90b3RhbF9zY2FsZWQiOiIyOTk5OTk5NzYyMTgiLCJkZXBvc2l0X2VuYWJsZWQiOnRydWUsImJvcnJvd19lbmFibGVkIjp0cnVlLCJkZXBvc2l0X2NhcCI6IjEwMDAwMDAwMDAwIn0K6QMKDgAHbWFya2V0c3Vvc21vEtYDeyJkZW5vbSI6InVvc21vIiwibWF4X2xvYW5fdG9fdmFsdWUiOiIwLjU1IiwibGlxdWlkYXRpb25fdGhyZXNob2xkIjoiMC42NSIsImxpcXVpZGF0aW9uX2JvbnVzIjoiMC4xIiwicmVzZXJ2ZV9mYWN0b3IiOiIwLjIiLCJpbnRlcmVzdF9yYXRlX21vZGVsIjp7Im9wdGltYWxfdXRpbGl6YXRpb25fcmF0ZSI6IjAuNyIsImJhc2UiOiIwLjMiLCJzbG9wZV8xIjoiMC4yNSIsInNsb3BlXzIiOiIwLjMifSwiYm9ycm93X2luZGV4IjoiMSIsImxpcXVpZGl0eV9pbmRleCI6IjEiLCJib3Jyb3dfcmF0ZSI6IjAuMSIsImxpcXVpZGl0eV9yYXRlIjoiMCIsImluZGV4ZXNfbGFzdF91cGRhdGVkIjoxNjY0MzA4MTk4LCJjb2xsYXRlcmFsX3RvdGFsX3NjYWxlZCI6IjAiLCJkZWJ0X3RvdGFsX3NjYWxlZCI6IjAiLCJkZXBvc2l0X2VuYWJsZWQiOnRydWUsImJvcnJvd19lbmFibGVkIjp0cnVlLCJkZXBvc2l0X2NhcCI6IjEwMDAwMDAwMDAwIn0Kcgo+AAtjb2xsYXRlcmFscwArb3NtbzFjeXl6cHhwbHhkemtlZWE3a3dzeWRhZGc4NzM1N3FuYWhha2Frc3Vpb24SMHsiYW1vdW50X3NjYWxlZCI6IjEwMDAwMDAwMDAwMDAiLCJlbmFibGVkIjp0cnVlfQqsAQoGY29uZmlnEqEBeyJvd25lciI6Im9zbW8xY3l5enB4cGx4ZHprZWVhN2t3c3lkYWRnODczNTdxbmFoYWtha3MiLCJhZGRyZXNzX3Byb3ZpZGVyIjoib3NtbzF3bjYyNXM0amNtdmswc3pwbDg1cmo1YXprZmM2c3V5dmY3NXE2dnJkZHNjamRwaHR2ZThzbTV5Mzd3IiwiY2xvc2VfZmFjdG9yIjoiMC41In0KSQoNY29udHJhY3RfaW5mbxI4eyJjb250cmFjdCI6ImNyYXRlcy5pbzptYXJzLXJlZC1iYW5rIiwidmVyc2lvbiI6IjAuMS4wIn0SAA==","proofOps": null,"height": "1180475","codespace": ""}}}`
		w.Write([]byte(testResponse))
	}))

	workitem := types.WorkItem{
		ContractAddress:    "testContractAddress",
		RPCEndpoint:        rpcServer.URL,
		ContractItemPrefix: "debts,collaterals",
		WorkItemType:       types.Redbank,
		ContractPageOffset: 0,
		ContractPageLimit:  10,
	}

	items, _, err := instance.fetchContractItems(workitem)

	if err != nil {
		t.Errorf("unable to fetch contract items: %s", err)
	}

	// We expect 10 items to be returned by the fetch of contract state
	expectedItemCount := 1
	actualItemCount := len(items)
	if actualItemCount != expectedItemCount {
		t.Errorf(
			"returned item counts doesn't match expected. Expected %d, got %d",
			expectedItemCount,
			actualItemCount,
		)
		return
	}
}

func TestRPCFetchRover(t *testing.T) {
	logger := logrus.WithFields(logrus.Fields{})
	queue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	cache, err := mock.NewRedisCache()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	instance, err := New(queue, cache, "collector", "health_check", logger)
	if err != nil {
		t.Errorf("unexpected failure to create Collector: %s", err)
	}

	rpcServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// RPC sample response containing 10 balance records is returned for any request
		testResponse := `{"jsonrpc": "2.0","id": 0,"result": {"response": {"code": 0,"log": "","info": "","index": "0","key": null,"value": "CnUKOO+/vQV0b2tlbnNfX293bmVy77+9K29zbW8xY3l5enB4cGx4ZHprZWVhN2t3c3lkYWRnODczNTdxbmFoYWtha3MyNxI5eyJhbW91bnRfc2NhbGVkIjoiMjk5OTk5OTc2MjE4IiwidW5jb2xsYXRlcmFsaXplZCI6ZmFsc2V9CgQKCu+/vQdtYXJrZXRzdWlvbhIEeyJkZW5vbSI6InVpb24iLCJtYXhfbG9hbl90b192YWx1ZSI6IjAuNjUiLCJsaXF1aWRhdGlvbl90aHJlc2hvbGQiOiIwLjciLCJsaXF1aWRhdGlvbl9ib251cyI6IjAuMSIsInJlc2VydmVfZmFjdG9yIjoiMC4yIiwiaW50ZXJlc3RfcmF0ZV9tb2RlbCI6eyJvcHRpbWFsX3V0aWxpemF0aW9uX3JhdGUiOiIwLjEiLCJiYXNlIjoiMC4zIiwic2xvcGVfMSI6IjAuMjUiLCJzbG9wZV8yIjoiMC4zIn0sImJvcnJvd19pbmRleCI6IjEuMDAwMDAwMDc5Mjc0NDgxNDY2IiwibGlxdWlkaXR5X2luZGV4IjoiMSIsImJvcnJvd19yYXRlIjoiMC42MTY2NjY2NjY2NjY2NjY2NjYiLCJsaXF1aWRpdHlfcmF0ZSI6IjAuMTQ3OTk5OTk5OTk5OTk5OTk5IiwiaW5kZXhlc19sYXN0X3VwZGF0ZWQiOjE2NjQzMDgyMTgsImNvbGxhdGVyYWxfdG90YWxfc2NhbGVkIjoiMTAwMDAwMDAwMDAwMCIsImRlYnRfdG90YWxfc2NhbGVkIjoiMjk5OTk5OTc2MjE4IiwiZGVwb3NpdF9lbmFibGVkIjp0cnVlLCJib3Jyb3dfZW5hYmxlZCI6dHJ1ZSwiZGVwb3NpdF9jYXAiOiIxMDAwMDAwMDAwMCJ9CgMKDu+/vQdtYXJrZXRzdW9zbW8SA3siZGVub20iOiJ1b3NtbyIsIm1heF9sb2FuX3RvX3ZhbHVlIjoiMC41NSIsImxpcXVpZGF0aW9uX3RocmVzaG9sZCI6IjAuNjUiLCJsaXF1aWRhdGlvbl9ib251cyI6IjAuMSIsInJlc2VydmVfZmFjdG9yIjoiMC4yIiwiaW50ZXJlc3RfcmF0ZV9tb2RlbCI6eyJvcHRpbWFsX3V0aWxpemF0aW9uX3JhdGUiOiIwLjciLCJiYXNlIjoiMC4zIiwic2xvcGVfMSI6IjAuMjUiLCJzbG9wZV8yIjoiMC4zIn0sImJvcnJvd19pbmRleCI6IjEiLCJsaXF1aWRpdHlfaW5kZXgiOiIxIiwiYm9ycm93X3JhdGUiOiIwLjEiLCJsaXF1aWRpdHlfcmF0ZSI6IjAiLCJpbmRleGVzX2xhc3RfdXBkYXRlZCI6MTY2NDMwODE5OCwiY29sbGF0ZXJhbF90b3RhbF9zY2FsZWQiOiIwIiwiZGVidF90b3RhbF9zY2FsZWQiOiIwIiwiZGVwb3NpdF9lbmFibGVkIjp0cnVlLCJib3Jyb3dfZW5hYmxlZCI6dHJ1ZSwiZGVwb3NpdF9jYXAiOiIxMDAwMDAwMDAwMCJ9CnIKPu+/vQtjb2xsYXRlcmFsc++/vStvc21vMWN5eXpweHBseGR6a2VlYTdrd3N5ZGFkZzg3MzU3cW5haGFrYWtzdWlvbhIweyJhbW91bnRfc2NhbGVkIjoiMTAwMDAwMDAwMDAwMCIsImVuYWJsZWQiOnRydWV9CgEKBmNvbmZpZxIBeyJvd25lciI6Im9zbW8xY3l5enB4cGx4ZHprZWVhN2t3c3lkYWRnODczNTdxbmFoYWtha3MiLCJhZGRyZXNzX3Byb3ZpZGVyIjoib3NtbzF3bjYyNXM0amNtdmswc3pwbDg1cmo1YXprZmM2c3V5dmY3NXE2dnJkZHNjamRwaHR2ZThzbTV5Mzd3IiwiY2xvc2VfZmFjdG9yIjoiMC41In0KSQoKY29udHJhY3RfaW5mbxI4eyJjb250cmFjdCI6ImNyYXRlcy5pbzptYXJzLXJlZC1iYW5rIiwidmVyc2lvbiI6IjAuMS4wIn0S77+9","proofOps": null,"height": "1180475","codespace": ""}}}`
		w.Write([]byte(testResponse))
	}))

	workitem := types.WorkItem{
		ContractAddress:    "testContractAddress",
		RPCEndpoint:        rpcServer.URL,
		ContractItemPrefix: "tokens__owner",
		WorkItemType:       types.Rover,
		ContractPageOffset: 0,
		ContractPageLimit:  10,
	}

	items, _, err := instance.fetchContractItems(workitem)

	if err != nil {
		t.Errorf("unable to fetch contract items: %s", err)
	}

	// We expect 10 items to be returned by the fetch of contract state
	expectedItemCount := 1
	actualItemCount := len(items)
	if actualItemCount != expectedItemCount {
		t.Errorf(
			"returned item counts doesn't match expected. Expected %d, got %d",
			expectedItemCount,
			actualItemCount,
		)
		return
	}
}

func TestRPCFetchIncorrectPrefix(t *testing.T) {
	logger := logrus.WithFields(logrus.Fields{})
	queue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	cache, err := mock.NewRedisCache()
	if err != nil {
		t.Errorf("failed to create mock Redis queue: %s", err)
	}

	instance, err := New(queue, cache, "collector", "health_check", logger)
	if err != nil {
		t.Errorf("unexpected failure to create Collector: %s", err)
	}

	rpcServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// RPC sample response containing 10 balance records is returned for any request
		testResponse := `{"jsonrpc": "2.0","id": 0,"result": {"response": {"code": 0,"log": "","info": "","index": "0","key": null,"value": "CjwKNQAHYmFsYW5jZXRlcnJhMTAwNXIydTM1bXJ3OXpxdm43ajVkM3gwNGdxNmNhcDIzMmtqd3V3EgMiMCIKRAo1AAdiYWxhbmNldGVycmExMDA1enk1Njljc2NjaDZxbDZmeDhyNWRnbnNuMHQ2ZTlmbTYweDYSCyIxNzg1NTQ0NTYiCkQKNQAHYmFsYW5jZXRlcnJhMTAwNzc2d3lzNWNyMGxjd25xM2hyajVnNjZlOG02eW5hMGdjMHlxEgsiMjUyMDg1NjM3Igo8CjUAB2JhbGFuY2V0ZXJyYTEwMGVjZjRhMzZoYW1wNDdhYThtNTgwN3RtdGh5YXB1dnozMGprahIDIjAiCkMKNQAHYmFsYW5jZXRlcnJhMTAwZXFnN3MyM3Z5ampyZ3A5NHd1ZWozdnhnZGEzcDI1djl3aHRxEgoiMjYxMTMyNDciCkMKNQAHYmFsYW5jZXRlcnJhMTAwanN1eXFkbnRwNnp6djlleDJ1d2xrYTRtbW1uZ3Y5a3o2Z2V1EgoiMjUxMTM5MjgiCjwKNQAHYmFsYW5jZXRlcnJhMTAwcGVzcHB2eTR1dHN2YWx3eHFsbWZybTY4cnYwcWVrMnBhanN3EgMiMCIKQwo1AAdiYWxhbmNldGVycmExMDB3c3M3azlkd3F2ZG40d2RlbDY1aDV1c3BybTNnYWpudTdobDgSCiIxMDgwNDY4MiIKQgo1AAdiYWxhbmNldGVycmExMDI1OTllOGxwazg2NTJla2xocW1reW5yOXB0OXZ6NWM2c3BrcjgSCSIyNDc3ODMwIgpDCjUAB2JhbGFuY2V0ZXJyYTEwMjZoYzV6ajNqcnN4aHpjMjA2Z2VrNmN0aHBnY3JlNnowZW5uNRIKIjQ5OTk5MTc5IhI3CjUAB2JhbGFuY2V0ZXJyYTEwMjZud3J5aGh3c2ZrY3E5czJsNDJranF2dnV3eGNtYTcyazBjbA==","proofOps": null,"height": "1180475","codespace": ""}}}`
		w.Write([]byte(testResponse))
	}))

	workitem := types.WorkItem{
		ContractAddress:    "testContractAddress",
		RPCEndpoint:        rpcServer.URL,
		ContractItemPrefix: "incorrectprefix",
		WorkItemType:       types.Redbank,
		ContractPageOffset: 0,
		ContractPageLimit:  10,
	}

	items, _, err := instance.fetchContractItems(workitem)

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
