package deployer

import (
	"io/ioutil"
	"testing"

	"github.com/sirupsen/logrus"
)

func TestNewDockerWithOpts(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)
	params := make(map[string]string)
	_, err := NewDocker("test_redis", "redis:latest", params, logrus.WithFields(logrus.Fields{}))
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}
}

func TestNewDockerWithoutOpts(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)
	_, err := NewDocker("test_redis", "redis:latest", nil, logrus.WithFields(logrus.Fields{}))
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}
}

func TestIncreaseDecrease(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)
	client, err := NewDocker("test_redis", "redis:latest", nil, logrus.WithFields(logrus.Fields{}))
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}

	err = client.Increase()
	if err != nil {
		t.Errorf("unexpected failure to increase service count: %s", err)
	}

	serviceCount, err := client.Count()
	if err != nil {
		t.Errorf("unexpected failure to read service count: %s", err)
	}

	expectedServiceCount := 1
	if serviceCount != expectedServiceCount {
		t.Errorf(
			"expected service count doesn't match actual after increase: expected %d, got %d",
			expectedServiceCount,
			serviceCount,
		)
	}

	err = client.Decrease()
	if err != nil {
		t.Errorf("unexpected failure to decrease service count: %s", err)
	}

	serviceCount, err = client.Count()
	if err != nil {
		t.Errorf("unexpected failure to read service count: %s", err)
	}

	expectedServiceCount = 0
	if serviceCount != expectedServiceCount {
		t.Errorf(
			"expected service count doesn't match actual after decrease: expected %d, got %d",
			expectedServiceCount,
			serviceCount,
		)
	}
}

func TestRemoveAll(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)
	client, err := NewDocker("test_redis", "redis:latest", nil, logrus.WithFields(logrus.Fields{}))
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}

	err = client.Increase()
	if err != nil {
		t.Errorf("unexpected failure to increase service count: %s", err)
	}

	serviceCount, err := client.Count()
	if err != nil {
		t.Errorf("unexpected failure to read service count: %s", err)
	}

	expectedServiceCount := 1
	if serviceCount != expectedServiceCount {
		t.Errorf(
			"expected service count doesn't match actual after increase: expected %d, got %d",
			expectedServiceCount,
			serviceCount,
		)
	}

	err = client.RemoveAll()
	if err != nil {
		t.Errorf("unexpected failure to decrease service count: %s", err)
	}

	serviceCount, err = client.Count()
	if err != nil {
		t.Errorf("unexpected failure to read service count: %s", err)
	}

	expectedServiceCount = 0
	if serviceCount != expectedServiceCount {
		t.Errorf(
			"expected service count doesn't match actual after decrease: expected %d, got %d",
			expectedServiceCount,
			serviceCount,
		)
	}
}
