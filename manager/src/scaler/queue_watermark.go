package scaler

import (
	"errors"

	"github.com/sirupsen/logrus"

	managerinterfaces "github.com/mars-protocol/multichain-liquidator-bot/monitor/src/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
)

// QueueWatermark implements an automatic scaler to ensure the amount of
// active services fall between the given watermark levels based on queue
// sizes
type QueueWatermark struct {
	queue         interfaces.Queuer
	queueName     string
	deployer      managerinterfaces.Deployer
	lowWaterMark  int
	highWaterMark int

	logger *logrus.Entry
}

// NewQueueWatermark creates a new instance of the scaler with the given
// watermark and queue parameters
//
// lowWaterMark determines the amount of items in the queue at which we'll
// scale down
// highWaterMark determines the amount of items in the queue at which we'll
// scale up
func NewQueueWatermark(
	queue interfaces.Queuer,
	queueName string,
	deployer managerinterfaces.Deployer,
	lowWaterMark int,
	highWaterMark int,
	logger *logrus.Entry,
) (*QueueWatermark, error) {

	if queue == nil {
		return nil, errors.New("a queue must be provided")
	}

	if queueName == "" {
		return nil, errors.New("queueName must not be blank")
	}

	if deployer == nil {
		return nil, errors.New("a deployer must be provided")
	}

	if lowWaterMark == 0 || highWaterMark == 0 {
		return nil, errors.New("low and high watermarks must be larger than zero")
	}

	return &QueueWatermark{
		queue:         queue,
		queueName:     queueName,
		deployer:      deployer,
		lowWaterMark:  lowWaterMark,
		highWaterMark: highWaterMark,
		logger: logger.WithFields(logrus.Fields{
			"subservice": "scaler",
			"type":       "queuewatermark",
			"queue":      queueName,
		}),
	}, nil
}

// ScaleAutomatic scales the service up or down based on the watermark paramaters
// If scaling should be executed returns the direction (up, down)
// and true with no error
func (qwm *QueueWatermark) ScaleAutomatic() (string, bool, error) {
	qwm.logger.Debug("Checking scaling parameters")

	if qwm.deployer.IsDeploying() {
		qwm.logger.Warn("Still deploying, skip parameter checks")
		return "none", false, nil
	}

	// Check the amount of items in the queue and determine whether we should
	// scale up or down
	itemCount, err := qwm.queue.CountItems(qwm.queueName)
	if err != nil {
		return "none", false, err
	}
	qwm.logger.WithFields(logrus.Fields{
		"item_count": itemCount,
	}).Debug("Checked queue size")

	// If the item count has dropped below the low watermark, we can scale down
	if itemCount <= qwm.lowWaterMark {
		return "down", true, qwm.deployer.Decrease()
	}

	// If the item count has risen above the high watermark, we can scale up
	if itemCount >= qwm.highWaterMark {
		return "up", true, qwm.deployer.Increase()
	}

	return "none", false, err
}

// ScaleUp scales the service up by one instance
func (qwm *QueueWatermark) ScaleUp() error {
	return qwm.deployer.Increase()
}

// ScaleDown scales the service down by one instance
func (qwm *QueueWatermark) ScaleDown() error {
	return qwm.deployer.Decrease()
}

// ScaleToZero scales the service down to zero instances
func (qwm *QueueWatermark) ScaleToZero() error {
	return qwm.deployer.RemoveAll()
}
