package main

import (
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/kelseyhightower/envconfig"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime"
	log "github.com/sirupsen/logrus"
)

// Config defines the environment variables for the service
type Config struct {
	runtime.BaseConfig

	ChainID      string `envconfig:"CHAIN_ID" required:"true"`
	HiveEndpoint string `envconfig:"HIVE_ENDPOINT" required:"true"`
	RPCEndpoint  string `envconfig:"RPC_ENDPOINT" required:"true"`

	QueueName     string `envconfig:"QUEUE_NAME" required:"true"`
	RedisEndpoint string `envconfig:"REDIS_ENDPOINT" required:"true"`
	RedisDatabase int    `envconfig:"REDIS_DATABASE" required:"true"`
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
	logger.Info("Setting up collector")

	// Handle stop signals
	go func() {
		sig := <-signalChannel
		logger.WithFields(log.Fields{
			"signal": sig,
		}).Info("Received OS signal")
	}()

	// Set up Redis as queue provider
	// var redisQueue interfaces.Queuer
	// redisQueue, err = queue.NewRedis(config.RedisEndpoint, config.RedisDatabase, config.QueueName, 5)
	// if err != nil {
	// 	panic(err)
	// }

	// TODO Set up collector

	logger.Info("Shutdown")

}
