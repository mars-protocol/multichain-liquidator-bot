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
func (service *Manager) collectMetrics(height int) ([]Metric, error) {

	var metrics []Metric

	// General
	// Current height (Chain)

	// Last processed height (Bot)
	metrics = append(metrics, Metric{
		Name:      "general.block_height",
		Value:     float64(height),
		Timestamp: time.Now().Unix(),
		Chain:     service.chainID,
	})

	// Lag between current and last processed (should be zero)
	// TODO:

	// Manager
	// Count of running collectors
	// Count of running health checkers
	// Count of running executors
	for scalerName, scaler := range service.scalers {
		count, err := scaler.Count()
		if err != nil {
			service.logger.WithFields(logrus.Fields{
				"height": height,
				"scaler": scalerName,
				"error":  err,
			}).Warning("Unable to get service count")
			continue
		}

		metric := Metric{
			Name:      fmt.Sprintf("manager.scaler.%s.count", scalerName),
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
	value, err := service.cache.GetFloat64("total_contract_items")
	if err != nil {
		service.logger.WithFields(logrus.Fields{
			"height": height,
			"metric": "total_contract_items",
			"error":  err,
		}).Warning("Unable to get metric from cache")
	} else {
		metric := Metric{
			Name:      "collector.contract_items.total",
			Value:     value,
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
	// Total amount of contract items missed (collateral + debts) (per block)
	// Health checker

	// Total amount of health checks to perform (per block)
	// Total amount of health checks performed (per block)
	// Total amount of health checks missed (per block)
	// Total healthy positions (since last check)
	// Total unhealthy positions (since last check)
	// Executor

	// Total liquidations
	// Total liquidations (per block)
	// Total liquidations missed

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
							Type: datadog.PtrString("chain"),
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
