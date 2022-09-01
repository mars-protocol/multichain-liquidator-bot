# Manager

The Manager service is responsible for ensuring all the data is processed within
a timeframe. By default, the timeframe is a single block. If we are left with 
unprocessed data by the time a new block arrives, the manager would scale up by 
deploying more instances of the service that is currently lagging. Conversely, if
we have too many instances of a service, it will be scaled down by removing
deployments.

This service also collects runtime performance data of all the parts of the 
system and will make the information available to other third-party tools so
that performance dashboards can be constructed.

## Building

### Requirements

1. Go
2. Docker (for Redis instance)

The service is built using a Makefile, use `make help` for more information.

### Basic build and run

```shell
# Install dependencies
make dependencies

# Build
make

# Build and run
make run

# Build Docker image
make docker_build

# Run Docker image
make docker_run

# Run tests
make test
```

### Configuration

The service is configured via environment variables, they can be found and 
changed in the Makefile.

|VARIABLE|TYPE|DESCRIPTION|
|--------|----|-----------|
LOG_LEVEL|string|Logging level - debug, info, warn, error, fatal|
LOG_FORMAT|string|Format of the log - text or json|
SERVICE_NAME|string|The name of the service in the structured log|
CHAIN_ID|string|Name of the chain for logging purposes|
HIVE_ENDPOINT|string|The Hive endpoint for all services in a deployment to use|
RPC_ENDPOINT|string|The JSON-RPC endpoint for all services in a deployment to use|
RPC_WEBSOCKET_ENDPOINT|string|The websocket endpoint for the chain to read new blocks from|
REDIS_DATABASE|int|The Redis database number for the queues|
REDIS_ENDPOINT|string|The Redis endpoint - 127.0.0.1:6379|
COLLECTOR_QUEUE_NAME|string|The Redis key to write work items to|
HEALTH_CHECK_QUEUE_NAME|string|The Redis key to monitor for health checker scaling|
EXECUTOR_QUEUE_NAME|string|The Redis key to monitor for executor scaling|
DEPLOYER_TYPE|string|The type of deployer to use, docker or aws-ecs|
COLLECTOR_IMAGE|string|The Docker image for the Collector service|
HEALTH_CHECKER_IMAGE|string|The Docker image for the Health Checker service|
EXECUTOR_IMAGE|string|The Docker image for the executor service|
SCALING_TYPE|string|The method to use for determining scaling, only watermark is available|


__AWS ECS specific variables__

|VARIABLE|TYPE|DESCRIPTION|
|--------|----|-----------|
AWS_ACCESS_KEY_ID|string|The AWS access key ID|
AWS_SECRET_ACCESS_KEY|string|The AWS secret access key|
AWS_CLUSTER_ARN|string|The ARN for the cluster to deploy to|
AWS_SERVICE_CPU_UNITS|int|The [CPU units](https://aws.amazon.com/premiumsupport/knowledge-center/ecs-cpu-allocation/) for each service deployment|
AWS_SERVICE_MEMORY_MB|int|The amount of memory in MB to assign to each instance|
AWS_SERVICE_SUBNETS|string array|The comma-delimited network subnets to deploy to, ex "subnet-123,subnet-124"|
AWS_SERVICE_SECURITY_GROUPS|string array|The comma-delimited security groups to deploy to, ex "sg-123,sg124"|