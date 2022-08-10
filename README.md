# Multichain liquidator bot

> **Notice**
>
> Compilation, execution and utilities are a work in progress
>

The multichain liquidator bot is a scalable liquidation bot that ensures accounts
are liquidated in a timely fashion.

The bot is composed of 4 distinct parts and more details are [available in this Notion document](https://www.notion.so/delphilabs/Query-Liquidation-Bot-d88aa1dfd0134ca88baa4c6add452fef)

1. Collector

Responsible for finding active credit accounts in Red Bank and via the credit
manager.

2. Health Checker

Queries all accounts to determine health factor.

3. Liquidator

Handles liquidations of accounts via smart contracts.

4. Monitor

Scales any of the services based on load.

## Usage

Each service contains utilities to build and run the code in a uniform manner by
way of Makefiles. Each Makefile contains a help that can be executed via 
`make help`.

The top-level Makefile contains helpers to build and run all the services and 
contains the same `make help`.

```shell
# Build all services
make

# Build all Docker images
make docker_build
```


