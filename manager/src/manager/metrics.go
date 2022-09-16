package manager

import (
	"context"
	"fmt"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	datadogV2 "github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
	"github.com/sirupsen/logrus"
)

// collectMetrics collects all service metrics to be reported to DataDog
func (service *Manager) collectMetrics(height int64) ([]Metric, error) {

	var metrics []Metric
	var metricsToClear []string

	// General
	// Current height (Chain)

	// Last processed height (Bot)
	metrics = append(metrics, Metric{
		Name:      "general.block_height",
		Value:     float64(height),
		Timestamp: time.Now().Unix(),
		Chain:     service.chainID,
	})

	// TODO:
	// Lag between current and last processed (should be zero)

	// Manager
	// Count of running collectors
	// Count of running health checkers
	// Count of running executors
	for scalerName, scaler := range service.scalers {
		metricName := fmt.Sprintf("manager.scaler.%s.count", scalerName)
		metricsToClear = append(metricsToClear, metricName)
		count, err := scaler.Count()
		if err != nil {
			service.logger.WithFields(logrus.Fields{
				"height": height,
				"scaler": scalerName,
				"metric": metricName,
				"error":  err,
			}).Warning("Unable to get service count")
			continue
		}

		metric := Metric{
			Name:      metricName,
			Value:     float64(count),
			Timestamp: time.Now().Unix(),
			Chain:     service.chainID,
		}
		metrics = append(metrics, metric)
		service.logger.WithFields(logrus.Fields{
			"metric": metric.Name,
			"value":  metric.Value,
		}).Debug("Collected metric")
	}

	// Collector

	// Total amount of contract items (collateral + debts) (per block)
	// We don't clear this metric as it is only updated at intervals and
	// not every block
	metricName := "collector.contract_items.total"
	total, err := service.metricsCache.GetFloat64(metricName)
	if err != nil {
		service.logger.WithFields(logrus.Fields{
			"height": height,
			"metric": metricName,
			"error":  err,
		}).Warning("Unable to get metric from cache")
	} else {
		metric := Metric{
			Name:      metricName,
			Value:     total,
			Timestamp: time.Now().Unix(),
			Chain:     service.chainID,
		}
		metrics = append(metrics, metric)
		service.logger.WithFields(logrus.Fields{
			"metric": metric.Name,
			"value":  metric.Value,
		}).Debug("Collected metric")
	}

	// Total amount of contract items scanned (collateral + debts) (per block)
	metricName = "collector.contract_items.scanned"
	metricsToClear = append(metricsToClear, metricName)
	scanned, err := service.metricsCache.GetFloat64(metricName)
	if err != nil {
		service.logger.WithFields(logrus.Fields{
			"height": height,
			"metric": metricName,
			"error":  err,
		}).Warning("Unable to get metric from cache")
	} else {
		metric := Metric{
			Name:      metricName,
			Value:     float64(scanned),
			Timestamp: time.Now().Unix(),
			Chain:     service.chainID,
		}
		metrics = append(metrics, metric)
		service.logger.WithFields(logrus.Fields{
			"metric": metric.Name,
			"value":  metric.Value,
		}).Debug("Collected metric")
	}

	// Total amount of contract items missed (collateral + debts) (per block)
	metricName = "collector.contract_items.missed"
	metricsToClear = append(metricsToClear, metricName)
	missed := total - scanned
	if missed < 0 {
		missed = 0
	}
	metric := Metric{
		Name:      metricName,
		Value:     float64(missed),
		Timestamp: time.Now().Unix(),
		Chain:     service.chainID,
	}
	metrics = append(metrics, metric)
	service.logger.WithFields(logrus.Fields{
		"metric": metric.Name,
		"value":  metric.Value,
	}).Debug("Collected metric")

	// Health checker
	// Total amount of health checks to perform (per block)
	metricName = "health_checker.accounts.total"
	metricsToClear = append(metricsToClear, metricName)
	accountTotal, err := service.metricsCache.GetFloat64(metricName)
	if err != nil {
		service.logger.WithFields(logrus.Fields{
			"height": height,
			"metric": metricName,
			"error":  err,
		}).Warning("Unable to get metric from cache")
	} else {
		metric := Metric{
			Name:      metricName,
			Value:     accountTotal,
			Timestamp: time.Now().Unix(),
			Chain:     service.chainID,
		}
		metrics = append(metrics, metric)
		service.logger.WithFields(logrus.Fields{
			"metric": metric.Name,
			"value":  metric.Value,
		}).Debug("Collected metric")
	}

	// Total amount of health checks performed (per block)
	metricName = "health_checker.accounts.scanned"
	metricsToClear = append(metricsToClear, metricName)
	scannedAccounts, err := service.metricsCache.GetFloat64(metricName)
	if err != nil {
		service.logger.WithFields(logrus.Fields{
			"height": height,
			"metric": metricName,
			"error":  err,
		}).Warning("Unable to get metric from cache")
	} else {
		metric := Metric{
			Name:      metricName,
			Value:     scannedAccounts,
			Timestamp: time.Now().Unix(),
			Chain:     service.chainID,
		}
		metrics = append(metrics, metric)
		service.logger.WithFields(logrus.Fields{
			"metric": metric.Name,
			"value":  metric.Value,
		}).Debug("Collected metric")
	}

	// Total amount of health checks missed (per block)
	metricName = "health_checker.accounts.missed"
	metricsToClear = append(metricsToClear, metricName)
	missed = accountTotal - scannedAccounts
	if missed < 0 {
		missed = 0
	}
	metric = Metric{
		Name:      metricName,
		Value:     float64(missed),
		Timestamp: time.Now().Unix(),
		Chain:     service.chainID,
	}
	metrics = append(metrics, metric)
	service.logger.WithFields(logrus.Fields{
		"metric": metric.Name,
		"value":  metric.Value,
	}).Debug("Collected metric")

	// Total healthy positions (since last check)
	metricName = "health_checker.unhealthy.total"
	metricsToClear = append(metricsToClear, metricName)
	totalUnhealthy, err := service.metricsCache.GetFloat64(metricName)
	if err != nil {
		service.logger.WithFields(logrus.Fields{
			"height": height,
			"metric": metricName,
			"error":  err,
		}).Warning("Unable to get metric from cache")
	} else {
		metric := Metric{
			Name:      metricName,
			Value:     totalUnhealthy,
			Timestamp: time.Now().Unix(),
			Chain:     service.chainID,
		}
		metrics = append(metrics, metric)
		service.logger.WithFields(logrus.Fields{
			"metric": metric.Name,
			"value":  metric.Value,
		}).Debug("Collected metric")
	}

	// Total unhealthy positions (since last check)
	metricName = "health_checker.accounts.healthy"
	metricsToClear = append(metricsToClear, metricName)
	healthy := scannedAccounts - totalUnhealthy
	if healthy < 0 {
		healthy = 0
	}
	metric = Metric{
		Name:      metricName,
		Value:     float64(healthy),
		Timestamp: time.Now().Unix(),
		Chain:     service.chainID,
	}
	metrics = append(metrics, metric)
	service.logger.WithFields(logrus.Fields{
		"metric": metric.Name,
		"value":  metric.Value,
	}).Debug("Collected metric")

	// Executor
	// Total liquidations
	metricName = "executor.liquidations.total"
	metricsToClear = append(metricsToClear, metricName)
	totalLiquidations, err := service.metricsCache.GetFloat64(metricName)
	if err != nil {
		service.logger.WithFields(logrus.Fields{
			"height": height,
			"metric": metricName,
			"error":  err,
		}).Warning("Unable to get metric from cache")
	} else {
		metric := Metric{
			Name:      metricName,
			Value:     totalLiquidations,
			Timestamp: time.Now().Unix(),
			Chain:     service.chainID,
		}
		metrics = append(metrics, metric)
		service.logger.WithFields(logrus.Fields{
			"metric": metric.Name,
			"value":  metric.Value,
		}).Debug("Collected metric")
	}

	// Total liquidations executed (per block)
	metricName = "executor.liquidations.executed"
	metricsToClear = append(metricsToClear, metricName)
	performedLiquidations, err := service.metricsCache.GetFloat64(metricName)
	if err != nil {
		service.logger.WithFields(logrus.Fields{
			"height": height,
			"metric": metricName,
			"error":  err,
		}).Warning("Unable to get metric from cache")
	} else {
		metric := Metric{
			Name:      metricName,
			Value:     performedLiquidations,
			Timestamp: time.Now().Unix(),
			Chain:     service.chainID,
		}
		metrics = append(metrics, metric)
		service.logger.WithFields(logrus.Fields{
			"metric": metric.Name,
			"value":  metric.Value,
		}).Debug("Collected metric")
	}

	// Total liquidations missed
	metricName = "executor.liquidations.missed"
	metricsToClear = append(metricsToClear, metricName)
	missedLiquidations := totalLiquidations - performedLiquidations
	if missedLiquidations < 0 {
		missedLiquidations = 0
	}
	metric = Metric{
		Name:      metricName,
		Value:     float64(missedLiquidations),
		Timestamp: time.Now().Unix(),
		Chain:     service.chainID,
	}
	metrics = append(metrics, metric)
	service.logger.WithFields(logrus.Fields{
		"metric": metric.Name,
		"value":  metric.Value,
	}).Debug("Collected metric")

	// Clear metrics from cache
	for _, metricName := range metricsToClear {
		// Cache keys and metric names are the same
		// Delete essentially sets them to zero
		service.metricsCache.Delete(metricName)
	}

	return metrics, nil
}

// submitMetrics submits all the collected metrics
func (service *Manager) submitMetrics(metrics []Metric) error {
	ctx := datadog.NewDefaultContext(context.Background())
	configuration := datadog.NewConfiguration()

	apiClient := datadog.NewAPIClient(configuration)
	api := datadogV2.NewMetricsApi(apiClient)

	for _, metric := range metrics {
		body := datadogV2.MetricPayload{
			Series: []datadogV2.MetricSeries{
				{
					Metric: metric.Name,
					Type:   datadogV2.METRICINTAKETYPE_UNSPECIFIED.Ptr(),
					Points: []datadogV2.MetricPoint{
						{
							Timestamp: datadog.PtrInt64(metric.Timestamp),
							Value:     datadog.PtrFloat64(metric.Value),
						},
					},
					Resources: []datadogV2.MetricResource{
						{
							Name: datadog.PtrString(metric.Chain),
							Type: datadog.PtrString("host"),
						},
					},
				},
			},
		}
		_, _, err := api.SubmitMetrics(ctx, body, *datadogV2.NewSubmitMetricsOptionalParameters())
		if err != nil {
			service.logger.WithFields(logrus.Fields{
				"metric": metric.Name,
				"error":  err,
			}).Warning("Unable to submit metric to DataDog")
		} else {
			service.logger.WithFields(logrus.Fields{
				"metric": metric.Name,
				"value":  metric.Value,
			}).Debug("Submitted metric")
		}
	}
	return nil
}
