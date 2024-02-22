#
# A Makefile to build, run and test code
#

.PHONY: default build fmt lint run run_race test clean vet docker_build docker_run docker_clean
# Add your image name here. For instance, if you are pushing to ECR, use <your-ecr>/multichain-liquidator:latest

GIT_COMMIT := $(shell git rev-list -1 HEAD)
BRANCH_NAME := $(shell git rev-parse --abbrev-ref HEAD)
BASE_IMAGE_NAME := 073581867161.dkr.ecr.ap-southeast-1.amazonaws.com/lbexecutorsm-apsoutheast1
IMAGE_NAME := $(BASE_IMAGE_NAME):$(BRANCH_NAME)-$(GIT_COMMIT)

# Required contract addresses. Refer to mars github documentation for mainnet addresses
REDBANK_ADDRESS := "osmo1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh7nad0vhyhtuhw3s0p34vn"
ORACLE_ADDRESS := "osmo1466nf3zuxpya8q9emxukd7vftaf6h4psr0a07srl5zw74zh84yjqkk0zfx"
CHAIN_ID := "liq_test"

# This makes the APP_NAME be the name of the current directory
# Ex. in path /home/dev/app/my-app the APP_NAME will be set to my-app
APP_NAME := $(notdir $(CURDIR))

default: build ## Default: Build the binary for the service

dependencies: ## Install dependencies for the service
	yarn install

build: ## Build the binary for the service
	yarn build

run: ## Build and run the service binary
	yarn start

run_node: build ## Run the service with race condition checking enabled
	node build/src/main.js

docker_build: build ## Build the service Docker container
	docker build --platform=linux/amd64 -t ${IMAGE_NAME} .

docker_run: ## Run the Docker container in interactive mode
	docker run -it --rm --network="host" \
	-e GAS_PRICE="0.001uosmo" \
	-e RPC_ENDPOINT="http://localhost:26657" \
	-e SEED="your seed goes here" \
	-e RPC_URL="http://localhost:26657" \
	-e LIQUIDATION_QUEUE_NAME="executor" \
	-e MAX_THREADS="20" \
	-e CHAIN_ID=${CHAIN_ID} \
	-e CONTRACT_REDBANK_ADDRESS=${REDBANK_ADDRESS} \
	-e CONTRACT_ORACLE_ADDRESS=${ORACLE_ADDRESS} \
		${IMAGE_NAME}

docker_push: ## Push the Docker container to the registry
	docker push ${IMAGE_NAME}

fmt: ## Format the code using `go fmt`
	go fmt ./...

test: ## Run the tests
	yarn test

test_integration: ## Run integration tests
	yarn test:integration

clean: ## Remove build
	rm -Rf ./build

help: ## Display this help screen
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'