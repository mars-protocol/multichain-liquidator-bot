package main

import (
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/kelseyhightower/envconfig"
	health_checker_rover "github.com/mars-protocol/multichain-liquidator-bot/health-checker-rover/src/health-checker-rover"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime/cache"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/queue"
	log "github.com/sirupsen/logrus"
)

type Config struct {
	runtime.BaseConfig
	RedisEndpoint        string `envconfig:"REDIS_ENDPOINT" required:"true"`
	RedisDatabase        int    `envconfig:"REDIS_DATABASE" required:"true"`
	RedisMetricsDatabase int    `envconfig:"REDIS_METRICS_DATABASE" required:"true"`
	HealthCheckQueueName string `envconfig:"HEALTH_CHECK_QUEUE_NAME" required:"true"`
	LiquidatorQueueName  string `envconfig:"LIQUIDATOR_QUEUE_NAME" required:"true"`
	HiveEndpoint         string `envconfig:"HIVE_ENDPOINT" required:"true"`
	RedbankAddress       string `envconfig:"REDBANK_ADDRESS" required:"true"`
	AddressesPerJob      int    `envconfig:"ADDRESS_PER_JOB" required:"true"`
	JobsPerWoker         int    `envconfig:"JOBS_PER_WORKER" required:"true"`
	BatchSize            int    `envconfig:"BATCH_SIZE" required:"true"`
}

func main() {
	var config Config
	err := envconfig.Process("", &config)
	if err != nil {
		log.Fatalf("Unable to process config: %s", err)
	}

	fmt.Println("config")
	fmt.Println(config)

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
		"service": strings.ToLower(config.ServiceName),
	})

	// Setup signal handler
	signalChannel := make(chan os.Signal, 1)
	signal.Notify(signalChannel, syscall.SIGINT, syscall.SIGTERM)

	// Start constructing the service
	logger.Info("Setting up dependencies")

	// Set up Redis as a queue provider for reading accounts to check and to push accounts to liquidate
	var instance interfaces.Queuer
	instance, err = queue.NewRedis(
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

	hive := health_checker_rover.RoverHive{HiveEndpoint: config.HiveEndpoint}

	// Set up health checker
	healthCheckerService, err := health_checker_rover.New(
		instance,
		metricsCacheProvider,
		hive,
		config.HealthCheckQueueName,
		config.LiquidatorQueueName,
		config.JobsPerWoker,
		config.BatchSize,
		config.AddressesPerJob,
		config.RedbankAddress,
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
		healthCheckerService.Stop()
	}()

	logger.Info("Start Health check service")

	// Run forever
	err = healthCheckerService.Run()
	if err != nil {
		logger.Fatal(err)
	}

	logger.Info("Shutdown")
}
