package main

import (
	"encoding/json"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/kelseyhightower/envconfig"
	log "github.com/sirupsen/logrus"

	"github.com/mars-protocol/multichain-liquidator-bot/manager/src/deployer"
	managerinterfaces "github.com/mars-protocol/multichain-liquidator-bot/manager/src/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/manager/src/manager"
	"github.com/mars-protocol/multichain-liquidator-bot/manager/src/scaler"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/cache"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/interfaces"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/queue"
)

const (
	// DeployerTypeDocker is for deployments using Docker
	DeployerTypeDocker = "docker"
	// DeployerTypeECS is for deployments using AWS Elastic Container Service
	DeployerTypeECS = "aws-ecs"
	// ScalingTypeWatermark scales based on watermark levels
	ScalingTypeWatermark = "watermark"
)

// Config defines the environment variables for the service
type Config struct {
	runtime.BaseConfig

	ChainID              string `envconfig:"CHAIN_ID" required:"true"`
	HiveEndpoint         string `envconfig:"HIVE_ENDPOINT" required:"true"`
	RPCEndpoint          string `envconfig:"RPC_ENDPOINT" required:"true"`
	RPCWebsocketEndpoint string `envconfig:"RPC_WEBSOCKET_ENDPOINT" required:"true"`
	LCDEndpoint          string `envconfig:"LCD_ENDPOINT" required:"true"`

	RedisEndpoint        string `envconfig:"REDIS_ENDPOINT" required:"true"`
	RedisDatabase        int    `envconfig:"REDIS_DATABASE" required:"true"`
	RedisMetricsDatabase int    `envconfig:"REDIS_METRICS_DATABASE" required:"true"`

	CollectorQueueName      string `envconfig:"COLLECTOR_QUEUE_NAME" required:"true"`
	CollectorItemsPerPacket int    `envconfig:"COLLECTOR_ITEMS_PER_PACKET" required:"true"`
	HealthCheckQueueName    string `envconfig:"HEALTH_CHECK_QUEUE_NAME" required:"true"`
	ExecutorQueueName       string `envconfig:"EXECUTOR_QUEUE_NAME" required:"true"`

	DeployerType       string `envconfig:"DEPLOYER_TYPE" required:"true"`
	CollectorImage     string `envconfig:"COLLECTOR_IMAGE" required:"true"`
	HealthCheckerImage string `envconfig:"HEALTH_CHECKER_IMAGE" required:"true"`
	ExecutorImage      string `envconfig:"EXECUTOR_IMAGE" required:"true"`

	ScalingType string `envconfig:"SCALING_TYPE" required:"true"`

	CollectorContract string `envconfig:"COLLECTOR_CONTRACT" required:"true"`

	CollectorConfig     string `envconfig:"COLLECTOR_CONFIG" required:"true"`
	HealthCheckerConfig string `envconfig:"HEALTH_CHECKER_CONFIG" required:"true"`
	ExecutorConfig      string `envconfig:"EXECUTOR_CONFIG" required:"true"`

	MetricsEnabled bool `envconfig:"METRICS_ENABLED" required:"true"`
}

func main() {
	var config Config
	err := envconfig.Process("", &config)
	if err != nil {
		log.Fatalf("Unable to process config: %s", err)
	}

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

	// Setup signal handler
	signalChannel := make(chan os.Signal, 1)
	signal.Notify(signalChannel, syscall.SIGINT, syscall.SIGTERM)

	// Construct the service
	logger.Info("Setting up manager")

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

	// Define all the deployers
	var collectorDeployer managerinterfaces.Deployer
	var healthCheckerDeployer managerinterfaces.Deployer
	var executorDeployer managerinterfaces.Deployer

	// We provide a map of scalers to the manager as we don't care about
	// individual scalers but rather that everything is handled in the
	// same manner each block
	scalers := make(map[string]managerinterfaces.Scaler)

	// Set up the deployer, AWS or Docker
	// The deployers need the container images for collector, health-checker
	// and liquidator
	collectorConfig, err := parseConfig(config.CollectorConfig)
	if err != nil {
		logger.Fatal(err)
	}
	healthCheckerConfig, err := parseConfig(config.HealthCheckerConfig)
	if err != nil {
		logger.Fatal(err)
	}
	executorConfig, err := parseConfig(config.ExecutorConfig)
	if err != nil {
		logger.Fatal(err)
	}

	switch strings.ToLower(config.DeployerType) {
	case DeployerTypeDocker:

		// Set up the collector's deployer
		collectorDeployer, err = deployer.NewDocker(
			"collector",
			config.CollectorImage,
			collectorConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

		// Set up the health checker's deployer
		healthCheckerDeployer, err = deployer.NewDocker(
			"health-checker",
			config.HealthCheckerImage,
			healthCheckerConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

		// Set up the executor's deployer
		executorDeployer, err = deployer.NewDocker(
			"executor",
			config.ExecutorImage,
			executorConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

	case DeployerTypeECS:

		// Set up the collector's deployer
		collectorDeployer, err = deployer.NewAWSECS(
			"collector",
			config.CollectorImage,
			collectorConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

		// Set up the health checker's deployer
		healthCheckerDeployer, err = deployer.NewAWSECS(
			"health-checker",
			config.HealthCheckerImage,
			healthCheckerConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

		// Set up the executor's deployer
		executorDeployer, err = deployer.NewAWSECS(
			"executor",
			config.ExecutorImage,
			executorConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

	default:
		logger.Fatal("Invalid deployer type specified: ", config.DeployerType)

	}

	switch strings.ToLower(config.ScalingType) {
	case ScalingTypeWatermark:
		// Set up the collector's scaler with the given deployer
		scalers["collector"], err = scaler.NewQueueWatermark(
			queueProvider,
			config.CollectorQueueName,
			collectorDeployer,
			0, // Scale down when we have no items in the queue
			1, // Scale up when we have 1 or more items in the queue
			1, // Minimum number of services
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

		// Set up the health checker's scaler with the given deployer
		scalers["health-check"], err = scaler.NewQueueWatermark(
			queueProvider,
			config.HealthCheckQueueName,
			healthCheckerDeployer,
			0, // Scale down when we have no items in the queue
			1, // Scale up when we have 1 or more items in the queue
			1, // Minimum number of services
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

		// Set up the executor's scaler with the given deployer
		scalers["executor"], err = scaler.NewQueueWatermark(
			queueProvider,
			config.ExecutorQueueName,
			executorDeployer,
			0, // Scale down when we have no items in the queue
			1, // Scale up when we have 1 or more items in the queue
			1, // Minimum number of services
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}
	default:
		logger.Fatal("Invalid scaling type specified: ", config.ScalingType)
	}

	// Set up the manager with the scalers
	// Manager requires an RPC websocket for being notified of new
	// blocks. It also needs to check whether the current amount of
	// collectors are able to query all the possible positions
	service, err := manager.New(
		config.ChainID,
		config.RPCEndpoint,
		config.RPCWebsocketEndpoint,
		config.LCDEndpoint,
		config.HiveEndpoint,
		queueProvider,
		metricsCacheProvider,
		config.CollectorQueueName,
		config.HealthCheckQueueName,
		config.ExecutorQueueName,
		scalers,
		config.CollectorContract,
		config.CollectorItemsPerPacket,
		config.MetricsEnabled,
		logger,
	)
	if err != nil {
		panic(err)
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

// parseConfig parses the JSON environment variable into a map to be used
// by other services
func parseConfig(input string) (map[string]string, error) {
	output := make(map[string]string)
	err := json.Unmarshal([]byte(input), &output)
	if err != nil {
		return nil, err
	}
	return output, nil
}
