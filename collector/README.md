# Collector

The Collector service is responsible for fetching all the user addresses that
have debts in the Mars Red Bank and passes them on to the Health Checker.

It does so by querying the underlying contract storage of a 
[cw-storage-plus](https://github.com/CosmWasm/cw-plus/tree/main/packages/storage-plus)
`Map` for keys that contain a specific prefix. We do it this way instead of paging
through the `Map` because we can query multiple pages in parallel using regular
page numbers. Paging through a `Map` using an iterator requires you to know the
last key of a page to query the next page - prohibiting parallel, non-overlapping,
queries. 

The service uses [Redis lists](https://redis.io/docs/data-types/lists/) 
as a queue.

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
HEALTH_CHECK_QUEUE_NAME|string|The Redis key to write results to|