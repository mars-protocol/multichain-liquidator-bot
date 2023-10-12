package scaler

import (
	"errors"

	"github.com/sirupsen/logrus"

	managerinterfaces "github.com/mars-protocol/multichain-liquidator-bot/manager/src/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
)

// QueueWatermark implements an automatic scaler to ensure the amount of
// active services fall between the given watermark levels based on queue
// sizes
type QueueWatermark struct {
	queue     interfaces.Queuer
	queueName string
	deployer  managerinterfaces.Deployer
	// watermarkViolationCount keeps track of the amount of times
	// the watermark was breached
	highWatermarkViolationCount int
	lowWatermarkViolationCount  int
	// watermarkViolationMax determines the maximum amount of times
	// the watermark was violated before scaling
	watermarkViolationMax               int
	lowWaterMark                        int
	highWaterMark                       int
	minimumServiceCount                 int
	maximumServiceCount                 int
	consecutiveBlocksCompletedThreshold int
	logger                              *logrus.Entry
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
	minimumServiceCount int,
	maximumServiceCount int,
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

	if highWaterMark == 0 {
		return nil, errors.New("high watermarks must be larger than zero")
	}

	if maximumServiceCount < minimumServiceCount {
		return nil, errors.New("maximumServiceCount must be larger than minimumServiceCount")
	}

	return &QueueWatermark{
		queue:                       queue,
		queueName:                   queueName,
		deployer:                    deployer,
		highWatermarkViolationCount: 0,
		lowWatermarkViolationCount:  0,
		watermarkViolationMax:       10,
		lowWaterMark:                lowWaterMark,
		highWaterMark:               highWaterMark,
		minimumServiceCount:         minimumServiceCount,
		maximumServiceCount:         maximumServiceCount,
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

	// If a minimum service count should be enforced, ensure we comply
	if qwm.minimumServiceCount > 0 {
		currentServiceCount, err := qwm.deployer.Count()
		if err != nil {
			return "none", false, err
		}
		if currentServiceCount < qwm.minimumServiceCount {
			return "up", true, qwm.ScaleUp()
		}
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

	// TODO Need to rethink the logic here, if we scale down when there are
	// no items in the queue, we might end up with a up/down loop if we
	// are processing everything just in time
	// If low watermark is zero, we'll never scale down

	// If the item count has dropped below the low watermark, we can scale down
	if itemCount <= qwm.lowWaterMark {

		qwm.lowWatermarkViolationCount++
		qwm.logger.WithFields(logrus.Fields{
			"new_value": qwm.lowWatermarkViolationCount,
			"max_value": qwm.watermarkViolationMax,
		}).Debug("Increased lower violation count")

		if qwm.lowWatermarkViolationCount >= qwm.watermarkViolationMax {
			qwm.logger.WithFields(logrus.Fields{
				"value":     qwm.lowWatermarkViolationCount,
				"max_value": qwm.watermarkViolationMax,
			}).Debug("Watermark violation maximum exceeded")
			qwm.lowWatermarkViolationCount = 0
			return "down", true, qwm.ScaleDown()
		}
	}

	// If the item count has risen above the high watermark, we can scale up
	if itemCount >= qwm.highWaterMark {
		qwm.highWatermarkViolationCount++
		qwm.logger.WithFields(logrus.Fields{
			"new_value": qwm.highWatermarkViolationCount,
			"max_value": qwm.watermarkViolationMax,
		}).Debug("Increased upper violation count")

		// To avoid scaling too aggressively we allow the watermark to be
		// breached a few times before scaling
		// This avoids scaling rapidly in case of a handful of query failures
		// that leave a queue above the high watermark
		if qwm.highWatermarkViolationCount >= qwm.watermarkViolationMax {
			qwm.logger.WithFields(logrus.Fields{
				"value":     qwm.highWatermarkViolationCount,
				"max_value": qwm.watermarkViolationMax,
			}).Debug("Watermark violation maximum exceeded")
			qwm.highWatermarkViolationCount = 0
			return "up", true, qwm.ScaleUp()
		}
	}

	return "none", false, err
}

// ScaleUp scales the service up by one instance
func (qwm *QueueWatermark) ScaleUp() error {
	currentServiceCount, err := qwm.deployer.Count()
	if err != nil {
		return err
	}

	proposedServiceCount := currentServiceCount + 1

	if proposedServiceCount > qwm.maximumServiceCount {
		qwm.logger.WithFields(logrus.Fields{
			"proposedServiceCount": proposedServiceCount,
			"maximumServiceCount":  qwm.maximumServiceCount,
		}).Debug("Scale up failed as proposed service count was higher than maximum count")
		return nil
	}

	return qwm.deployer.Increase()
}

// ScaleDown scales the service down by one instance
func (qwm *QueueWatermark) ScaleDown() error {
	currentServiceCount, err := qwm.deployer.Count()
	if err != nil {
		return err
	}
	proposedServiceCount := currentServiceCount - 1
	if proposedServiceCount < qwm.minimumServiceCount {
		qwm.logger.WithFields(logrus.Fields{
			"proposedServiceCount": proposedServiceCount,
			"minimumServiceCount":  qwm.minimumServiceCount,
		}).Debug("Scale down failed as proposed service count was lower than minumum count")
		return nil
	}
	return qwm.deployer.Decrease()
}

// ScaleToZero scales the service down to zero instances
func (qwm *QueueWatermark) ScaleToZero() error {
	// Scale to zero won't work with a minimum service count
	qwm.minimumServiceCount = 0
	return qwm.deployer.RemoveAll()
}

// Count returns the amount of services deployed under this scaler
func (qwm *QueueWatermark) Count() (int, error) {
	return qwm.deployer.Count()
}
