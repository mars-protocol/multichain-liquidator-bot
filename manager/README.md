# Monitor

TODO

TODO: Add other envvars

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
REDIS_DATABASE|int|The Redis database number for the queues|
REDIS_ENDPOINT|string|The Redis endpoint - 127.0.0.1:6379|
COLLECTOR_QUEUE_NAME|string|The Redis key to read work items from|

