# Health Checker

Health Checker is responsible for fetching the health status for positions, 
and flagging unhealthy positions for liquidation.

It does this by reading from a Redis Queue, called the `HealthCheckerQueue` 
which contains user positions to be checked. It then checks these positions 
in batches via a hive query, before filtering through the returned health
status for unhealthy positions. These unhealthy positions are pushed into
another redis queue called `LiquidationQueue`, which exposes them for liquidation
by the executor module.

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