package main

import (
	"fmt"
	"os"
	"os/signal"
	"strconv"
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
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/types"
)

const (
	// DeployerTypeDocker is for deployments using Docker
	DeployerTypeDocker = "docker"
	// DeployerTypeECS is for deployments using AWS Elastic Container Service
	DeployerTypeECS = "aws-ecs"
	// ScalingTypeWatermark scales based on watermark levels
	ScalingTypeWatermark = "watermark"
	// Contract prefixs are used to identify values we want from contract state
	RedbankContractPrefix = "debts"
	RoverContractPrefix   = "tokens__owner"
	// redis database info
	RedbankDatabaseIndex = 0
	RoverDatabaseIndex   = 0
	// Health checker config params
	AddressesPerJob = "100"
	JobsPerWorker   = "10"
	BatchSize       = "1000"
	//Collector service config
	CollectorItemsPerPacket = 4000
)

// Config defines the environment variables for the service
type EnvironmentConfig struct {
	runtime.BaseConfig

	ChainID              string `envconfig:"CHAIN_ID" required:"true"`
	HiveEndpoint         string `envconfig:"HIVE_ENDPOINT" required:"true"`
	RPCEndpoint          string `envconfig:"RPC_ENDPOINT" required:"true"`
	RPCWebsocketEndpoint string `envconfig:"RPC_WEBSOCKET_ENDPOINT" required:"true"`
	LCDEndpoint          string `envconfig:"LCD_ENDPOINT" required:"true"`
	RedisEndpoint        string `envconfig:"REDIS_ENDPOINT" required:"true"`

	CollectorImage     string `envconfig:"COLLECTOR_IMAGE" required:"true"`
	HealthCheckerImage string `envconfig:"HEALTH_CHECKER_IMAGE" required:"true"`
	ExecutorImage      string `envconfig:"EXECUTOR_IMAGE" required:"true"`

	WorkItemType types.WorkItemType `envconfig:"WORK_ITEM_TYPE" required:"true"`

	DeployerType string `envconfig:"DEPLOYER_TYPE" required:"true"`

	RedbankAddress    string `envconfig:"REDBANK_ADDRESS" required:"true"`
	AccountNftAddress string `envconfig:"ACCOUNT_NFT_ADDRESS" required:"true"`
}

type DeploymentConfig struct {
	CollectorQueueName      string
	CollectorItemsPerPacket int
	HealthCheckQueueName    string
	ExecutorQueueName       string

	RedisDatabase        int
	RedisMetricsDatabase int

	CollectorContract string
	ContractPrefix    string

	CollectorConfig     map[string]string
	HealthCheckerConfig map[string]string
	ExecutorConfig      map[string]string

	MetricsEnabled bool

	ScalingType string
}

type Config struct {
	EnvironmentConfig
	DeploymentConfig
}

func getRedisDatabase(workItemType types.WorkItemType) int {
	if workItemType == types.Redbank {
		return RedbankDatabaseIndex
	}

	return RoverDatabaseIndex
}

func getExecutorServiceConfig(environmentConfig EnvironmentConfig, executorServiceId string, serviceType types.WorkItemType) map[string]string {
	executorEnv := make(map[string]string)
	executorEnv["RPC_ENDPOINT"] = environmentConfig.RPCEndpoint

	executorEnv["LIQUIDATION_QUEUE_NAME"] = executorServiceId
	executorEnv["LCD_ENDPOINT"] = environmentConfig.LCDEndpoint
	executorEnv["HIVE_ENDPOINT"] = environmentConfig.HiveEndpoint
	executorEnv["REDIS_ENDPOINT"] = environmentConfig.RedisEndpoint
	executorEnv["REDIS_METRICS_DATABASE"] = strconv.Itoa(getRedisDatabase(serviceType))
	executorEnv["REDIS_DATABASE"] = strconv.Itoa(getRedisDatabase(serviceType))

	return executorEnv
}

func getCollectorServiceConfig(environmentConfig EnvironmentConfig, collectorServiceId string, healthCheckServiceId string, serviceType types.WorkItemType) map[string]string {

	collectorEnv := make(map[string]string)
	collectorEnv["LOG_LEVEL"] = environmentConfig.BaseConfig.LogLevel
	collectorEnv["LOG_FORMAT"] = environmentConfig.BaseConfig.LogFormat
	collectorEnv["SERVICE_NAME"] = environmentConfig.BaseConfig.ServiceName
	collectorEnv["CHAIN_ID"] = environmentConfig.ChainID
	collectorEnv["REDIS_DATABASE"] = strconv.Itoa(getRedisDatabase(serviceType))
	collectorEnv["REDIS_ENDPOINT"] = environmentConfig.RedisEndpoint
	collectorEnv["REDIS_METRICS_DATABASE"] = strconv.Itoa(getRedisDatabase(serviceType))
	collectorEnv["COLLECTOR_QUEUE_NAME"] = collectorServiceId
	collectorEnv["HEALTH_CHECK_QUEUE_NAME"] = healthCheckServiceId

	return collectorEnv
}

func getHealthCheckerServiceConfig(environmentConfig EnvironmentConfig, healthCheckServiceId string, executorServiceId string, serviceType types.WorkItemType) map[string]string {

	collectorContract := environmentConfig.RedbankAddress

	if serviceType == types.Rover {
		collectorContract = environmentConfig.AccountNftAddress
	}

	healthCheckerEnv := make(map[string]string)
	healthCheckerEnv["LOG_LEVEL"] = environmentConfig.BaseConfig.LogLevel
	healthCheckerEnv["LOG_FORMAT"] = environmentConfig.BaseConfig.LogFormat
	healthCheckerEnv["SERVICE_NAME"] = environmentConfig.BaseConfig.ServiceName + healthCheckServiceId
	healthCheckerEnv["CHAIN_ID"] = environmentConfig.ChainID
	healthCheckerEnv["REDIS_DATABASE"] = strconv.Itoa(getRedisDatabase(serviceType))
	healthCheckerEnv["REDIS_ENDPOINT"] = environmentConfig.RedisEndpoint
	healthCheckerEnv["REDIS_METRICS_DATABASE"] = strconv.Itoa(getRedisDatabase(serviceType))
	healthCheckerEnv["HEALTH_CHECK_QUEUE_NAME"] = healthCheckServiceId
	healthCheckerEnv["LIQUIDATOR_QUEUE_NAME"] = executorServiceId
	healthCheckerEnv["HIVE_ENDPOINT"] = environmentConfig.HiveEndpoint
	healthCheckerEnv["REDBANK_ADDRESS"] = collectorContract
	healthCheckerEnv["ADDRESS_PER_JOB"] = AddressesPerJob
	healthCheckerEnv["JOBS_PER_WORKER"] = JobsPerWorker
	healthCheckerEnv["BATCH_SIZE"] = BatchSize

	return healthCheckerEnv
}

func setUpManager(serviceConfig DeploymentConfig, environmentConfig EnvironmentConfig, logger *log.Entry, workItemType types.WorkItemType) *manager.Manager {
	logger.Info("Setting up manager")
	var queueProvider interfaces.Queuer
	queueProvider, err := queue.NewRedis(
		environmentConfig.RedisEndpoint,
		serviceConfig.RedisDatabase,
		5, // BLPOP timeout seconds
	)

	if err != nil {
		logger.Fatal(err)
	}

	var metricsCacheProvider interfaces.Cacher
	metricsCacheProvider, err = cache.NewRedis(
		environmentConfig.RedisEndpoint,
		serviceConfig.RedisMetricsDatabase,
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

	executorServiceId := fmt.Sprintf("%s-executor-%s", workItemType, environmentConfig.ChainID)
	collectorServiceId := fmt.Sprintf("%s-collector-%s", workItemType, environmentConfig.ChainID)
	healthCheckServiceId := fmt.Sprintf("%s-health-check-%s", workItemType, environmentConfig.ChainID)
	switch strings.ToLower(environmentConfig.DeployerType) {
	case DeployerTypeDocker:

		// Set up the collector's deployer
		collectorDeployer, err = deployer.NewDocker(
			collectorServiceId,
			environmentConfig.CollectorImage,
			serviceConfig.CollectorConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

		healthCheckerDeployer, err = deployer.NewDocker(
			healthCheckServiceId,
			environmentConfig.HealthCheckerImage,
			serviceConfig.HealthCheckerConfig,
			logger,
		)

		// Set up the executor's deployer
		executorDeployer, err = deployer.NewDocker(
			executorServiceId,
			environmentConfig.ExecutorImage,
			serviceConfig.ExecutorConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

	case DeployerTypeECS:

		// Set up the collector's deployer
		collectorDeployer, err = deployer.NewAWSECS(
			collectorServiceId,
			environmentConfig.CollectorImage,
			serviceConfig.CollectorConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

		healthCheckerDeployer, err = deployer.NewAWSECS(
			healthCheckServiceId,
			environmentConfig.HealthCheckerImage,
			serviceConfig.HealthCheckerConfig,
			logger,
		)

		if err != nil {
			logger.Fatal(err)
		}

		// Set up the executor's deployer
		executorDeployer, err = deployer.NewAWSECS(
			executorServiceId,
			environmentConfig.ExecutorImage,
			serviceConfig.ExecutorConfig,
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}

	default:
		logger.Fatal("Invalid deployer type specified: ", environmentConfig.DeployerType)
	}

	switch strings.ToLower(serviceConfig.ScalingType) {
	case ScalingTypeWatermark:
		// Set up the collector's scaler with the given deployer
		scalers[collectorServiceId], err = scaler.NewQueueWatermark(
			queueProvider,
			serviceConfig.CollectorQueueName,
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
		scalers[healthCheckServiceId], err = scaler.NewQueueWatermark(
			queueProvider,
			serviceConfig.HealthCheckQueueName,
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
		scalers[executorServiceId], err = scaler.NewQueueWatermark(
			queueProvider,
			serviceConfig.ExecutorQueueName,
			executorDeployer,
			0,     // Scale down when we have no items in the queue
			10000, // We do not want to scale up the executor
			1,     // Minimum number of services
			logger,
		)
		if err != nil {
			logger.Fatal(err)
		}
	default:
		logger.Fatal("Invalid scaling type specified: ", serviceConfig.ScalingType)
	}

	// Set up the manager with the scalers
	// Manager requires an RPC websocket for being notified of new
	// blocks. It also needs to check whether the current amount of
	// collectors are able to query all the possible positions
	service, err := manager.New(
		environmentConfig.ChainID,
		environmentConfig.RPCEndpoint,
		environmentConfig.RPCWebsocketEndpoint,
		environmentConfig.LCDEndpoint,
		environmentConfig.HiveEndpoint,
		queueProvider,
		metricsCacheProvider,
		serviceConfig.CollectorQueueName,
		serviceConfig.HealthCheckQueueName,
		serviceConfig.ExecutorQueueName,
		scalers,
		serviceConfig.CollectorContract,
		serviceConfig.CollectorItemsPerPacket,
		serviceConfig.ContractPrefix,
		workItemType,
		serviceConfig.MetricsEnabled,
		logger,
	)

	if err != nil {
		logger.Fatal(err)
	}

	return service
}

func getDeploymentConfig(environmentConfig EnvironmentConfig, serviceType types.WorkItemType) DeploymentConfig {

	executorServiceId := fmt.Sprintf("%s-executor-%s", serviceType, environmentConfig.ChainID)
	collectorServiceId := fmt.Sprintf("%s-collector-%s", serviceType, environmentConfig.ChainID)
	healthCheckServiceId := fmt.Sprintf("%s-health-check-%s", environmentConfig.WorkItemType, environmentConfig.ChainID)

	redisDatabaseIndex := RedbankDatabaseIndex
	if environmentConfig.WorkItemType == types.Rover {
		redisDatabaseIndex = RoverDatabaseIndex
	}

	collectorContract := environmentConfig.RedbankAddress
	contractPrefix := RedbankContractPrefix
	if serviceType == types.Rover {
		collectorContract = environmentConfig.AccountNftAddress
		contractPrefix = RoverContractPrefix
	}

	return DeploymentConfig{
		CollectorQueueName:      collectorServiceId,
		CollectorItemsPerPacket: CollectorItemsPerPacket,
		HealthCheckQueueName:    healthCheckServiceId,
		ExecutorQueueName:       executorServiceId,
		RedisDatabase:           redisDatabaseIndex,
		RedisMetricsDatabase:    redisDatabaseIndex,
		CollectorContract:       collectorContract,
		ContractPrefix:          contractPrefix,
		CollectorConfig:         getCollectorServiceConfig(environmentConfig, collectorServiceId, healthCheckServiceId, serviceType),
		HealthCheckerConfig:     getHealthCheckerServiceConfig(environmentConfig, healthCheckServiceId, executorServiceId, serviceType),
		ExecutorConfig:          getExecutorServiceConfig(environmentConfig, executorServiceId, serviceType),
		MetricsEnabled:          true,
		ScalingType:             ScalingTypeWatermark,
	}
}

func main() {

	var environmentConfig EnvironmentConfig
	err := envconfig.Process("", &environmentConfig)
	if err != nil {
		log.Fatalf("Unable to process config: %s", err)
	}

	log.SetOutput(os.Stdout)
	log.SetFormatter(&log.JSONFormatter{
		TimestampFormat: "Jan 02 15:04:05",
	})
	if strings.ToLower(environmentConfig.LogFormat) == "text" {
		log.SetFormatter(&log.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: "Jan 02 15:04:05",
		})
	}
	logLevel, err := log.ParseLevel(environmentConfig.LogLevel)
	if err != nil {
		log.Fatalf("Unable to parse log level: %s", err)
	}
	log.SetLevel(logLevel)
	logger := log.WithFields(log.Fields{
		"service":  strings.ToLower(fmt.Sprintf("%s", environmentConfig.WorkItemType)),
		"chain_id": strings.ToLower(environmentConfig.ChainID),
	})

	// Setup signal handler
	signalChannel := make(chan os.Signal, 1)
	signal.Notify(signalChannel, syscall.SIGINT, syscall.SIGTERM)

	// Construct the service

	serviceType := environmentConfig.WorkItemType

	config := getDeploymentConfig(environmentConfig, serviceType)

	// Set up Redis as queue provider
	service := setUpManager(config, environmentConfig, logger, serviceType)

	// Handle stop signals
	go func() {
		sig := <-signalChannel
		logger.WithFields(log.Fields{
			"signal": sig,
		}).Info("Received OS signal")

		service.Stop()
	}()

	logger.Info("Starting services")

	// Run forever
	err = service.Run()
	if err != nil {
		logger.Fatal(err)
	}

	logger.Info("Shutdown")

}
