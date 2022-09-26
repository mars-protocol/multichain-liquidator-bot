package main

import (
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/kelseyhightower/envconfig"
	log "github.com/sirupsen/logrus"

	"github.com/mars-protocol/multichain-liquidator-bot/collector/src/collector"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/cache"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/queue"
)

// Config defines the environment variables for the service
type Config struct {
	runtime.BaseConfig

	ChainID string `envconfig:"CHAIN_ID" required:"true"`

	RedisEndpoint        string `envconfig:"REDIS_ENDPOINT" required:"true"`
	RedisDatabase        int    `envconfig:"REDIS_DATABASE" required:"true"`
	RedisMetricsDatabase int    `envconfig:"REDIS_METRICS_DATABASE" required:"true"`
	CollectorQueueName   string `envconfig:"COLLECTOR_QUEUE_NAME" required:"true"`
	HealthCheckQueueName string `envconfig:"HEALTH_CHECK_QUEUE_NAME" required:"true"`
}

func main() {
	// Parse config vai environment variables
	var config Config
	err := envconfig.Process("", &config)
	if err != nil {
		log.Fatalf("Unable to process config: %s", err)
	}

	// Set up structured logging
	log.SetOutput(os.Stdout)
	log.SetFormatter(&log.JSONFormatter{
		TimestampFormat: "Jan 02 15:04:05",
	})
	if strings.ToLower(config.LogFormat) == "text" {
		log.SetFormatter(&log.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: "Jan 02 15:04:05",
		})
	}
	logLevel, err := log.ParseLevel(config.LogLevel)
	if err != nil {
		log.Fatalf("Unable to parse log level: %s", err)
	}
	log.SetLevel(logLevel)
	logger := log.WithFields(log.Fields{
		"service":  strings.ToLower(config.ServiceName),
		"chain_id": strings.ToLower(config.ChainID),
	})

	// Set up signal handler, ie ctrl+c
	signalChannel := make(chan os.Signal, 1)
	signal.Notify(signalChannel, syscall.SIGINT, syscall.SIGTERM)

	// Construct the service
	logger.Info("Init service")

	// Set up Redis as queue provider
	var queueProvider interfaces.Queuer
	queueProvider, err = queue.NewRedis(
		config.RedisEndpoint,
		config.RedisDatabase,
		5, // BLPOP timeout seconds
	)
	if err != nil {
		logger.Fatal(err)
	}

	var metricsCacheProvider interfaces.Cacher
	metricsCacheProvider, err = cache.NewRedis(
		config.RedisEndpoint,
		config.RedisMetricsDatabase,
	)
	if err != nil {
		logger.Fatal(err)
	}

	// Set up collector
	service, err := collector.New(
		queueProvider,
		metricsCacheProvider,
		config.CollectorQueueName,
		config.HealthCheckQueueName,
		logger,
	)
	if err != nil {
		logger.Fatal(err)
	}

	// Handle stop signals
	go func() {
		sig := <-signalChannel
		logger.WithFields(log.Fields{
			"signal": sig,
		}).Info("Received OS signal")
		service.Stop()
	}()

	logger.Info("Start service")
	// Run forever
	err = service.Run()
	if err != nil {
		logger.Fatal(err)
	}

	logger.Info("Shutdown")
}
