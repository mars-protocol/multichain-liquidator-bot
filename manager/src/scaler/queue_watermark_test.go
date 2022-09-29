package scaler

import (
	"io/ioutil"
	"testing"

	"github.com/mars-protocol/multichain-liquidator-bot/manager/src/deployer"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/mock"
	"github.com/sirupsen/logrus"
)

func TestNewQueueWaterMark(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)

	mockDeployer := deployer.NewMock()
	mockQueue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("unexpected failure to create mock Redis: %s", err)
	}

	_, err = NewQueueWatermark(
		mockQueue,
		"test",
		mockDeployer,
		10, // low
		20, // high
		0,  // minimum service count
		logrus.WithFields(logrus.Fields{}),
	)
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}
}

func TestScaleUp(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)

	mockDeployer := deployer.NewMock()
	mockQueue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("unexpected failure to create mock Redis: %s", err)
	}

	qwm, err := NewQueueWatermark(
		mockQueue,
		"test",
		mockDeployer,
		10, // low
		20, // high
		0,  // minimum service count
		logrus.WithFields(logrus.Fields{}),
	)
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}

	err = qwm.ScaleUp()
	if err != nil {
		t.Errorf("unexpected failure to scale up: %s", err)
	}
}

func TestScaleDownWithoutMinimum(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)

	mockDeployer := deployer.NewMock()
	mockQueue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("unexpected failure to create mock Redis: %s", err)
	}

	qwm, err := NewQueueWatermark(
		mockQueue,
		"test",
		mockDeployer,
		10, // low
		20, // high
		0,  // minimum service count
		logrus.WithFields(logrus.Fields{}),
	)
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}

	err = qwm.ScaleUp()
	if err != nil {
		t.Errorf("unexpected failure to scale up: %s", err)
	}

	err = qwm.ScaleDown()
	if err != nil {
		t.Errorf("unexpected failure to scale down: %s", err)
	}
}

func TestScaleDownWithMinimum(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)

	mockDeployer := deployer.NewMock()
	mockQueue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("unexpected failure to create mock Redis: %s", err)
	}

	qwm, err := NewQueueWatermark(
		mockQueue,
		"test",
		mockDeployer,
		10, // low
		20, // high
		1,  // minimum service count
		logrus.WithFields(logrus.Fields{}),
	)
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}

	err = qwm.ScaleUp()
	if err != nil {
		t.Errorf("unexpected failure to scale up: %s", err)
	}

	err = qwm.ScaleDown()
	if err == nil {
		t.Errorf("expected failure to scale down below minimum, but passed")
	}
}

func TestScaleAutomaticWithMinimum(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)

	mockDeployer := deployer.NewMock()
	mockQueue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("unexpected failure to create mock Redis: %s", err)
	}

	qwm, err := NewQueueWatermark(
		mockQueue,
		"test",
		mockDeployer,
		10, // low
		20, // high
		1,  // minimum service count
		logrus.WithFields(logrus.Fields{}),
	)
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}

	direction, shouldScale, err := qwm.ScaleAutomatic()
	if err != nil {
		t.Errorf("unexpected failure to scale automatically: %s", err)
	}

	if direction != "up" {
		t.Errorf("expected scale direction to be up, got: %s", direction)
	}

	if !shouldScale {
		t.Errorf("expected automatic scaling to trigger, but it didn't")
	}
}

func TestScaleAutomaticWithoutMinimumNoScaling(t *testing.T) {

	logrus.SetOutput(ioutil.Discard)

	mockDeployer := deployer.NewMock()
	mockQueue, err := mock.NewRedisQueue()
	if err != nil {
		t.Errorf("unexpected failure to create mock Redis: %s", err)
	}

	qwm, err := NewQueueWatermark(
		mockQueue,
		"test",
		mockDeployer,
		0,  // low
		20, // high
		0,  // minimum service count
		logrus.WithFields(logrus.Fields{}),
	)
	if err != nil {
		t.Errorf("unexpected failure to create Docker: %s", err)
	}

	direction, shouldScale, err := qwm.ScaleAutomatic()
	if err != nil {
		t.Errorf("unexpected failure to scale automatically: %s", err)
	}

	if direction != "none" {
		t.Errorf("expected scale direction to be none, got: %s", direction)
	}

	if shouldScale {
		t.Errorf("expected automatic scaling not to trigger, but it did")
	}
}
