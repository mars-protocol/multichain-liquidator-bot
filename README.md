# Multichain liquidator bot

The multichain liquidator bot is a scalable liquidation bot that ensures accounts
are liquidated in a timely fashion.

It is built to support both the [RedBank](https://github.com/mars-protocol/red-bank) and [Rover](https://github.com/mars-protocol/v2-fields-of-mars).

NOTE: For questions, issues or support, feel free to join the `liquidators` channel in the mars discord

The bot is composed of 4 distinct parts. As an overview of the architecture, please refer to this image. Each part is explained in more detail below.


The Liquidator service is responsible for handling liquidations of unhealthy positions. There are liquidation services (called `executors`) for both Redbank and Credit Manager. More info in [liquidator](./liquidator/README.md).

## Usage

Each service contains utilities to build and run the code in a uniform manner by
way of Makefiles. Each Makefile contains a help that can be executed via 
`make help`.

The top-level Makefile contains helpers to build and run all the services and 
contains the same `make help`.

```shell
# Help
make help

# Build all services
make

# Build Docker images and start manager
make run

# Build all Docker images
make docker_build
```