#
# A Makefile to build, run and test code
#

.PHONY: default build fmt lint run run_race test clean vet docker_build docker_run docker_clean

IMAGE_NAME := "multichain-liquidator:latest"
GIT_COMMIT := $(shell git rev-list -1 HEAD)

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
	node build/src/index.js

docker_build: build ## Build the service Docker container
	docker build -t ${IMAGE_NAME} .

docker_run: ## Run the Docker container in interactive mode
	docker run -it --rm --network="host" \
	-e GAS_PRICE="0.001uosmo" \
	-e RPC_ENDPOINT="http://localhost:26657" \
	-e SEED="notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius" \
	-e ACCOUNTS_PER_SEED="100" \
	-e RPC_URL="http://localhost:26657" \
	-e QUEUE_NAME="throughput_test" \
	-e LIQUIDATION_QUEUE_NAME="executor" \
	-e ATOM_DENOM="uion" \
	-e OSMO_DENOM="uosmo" \
	-e MAX_THREADS="20" \
	-e OUTPOST_ARTIFACTS_PATH="/Users/<usernamezz>/outposts/artifacts/" \
	-e CHAIN_ID="localosmosis" \
	-e CONTRACT_REDBANK_ADDRESS="osmo1suhgf5svhu4usrurvxzlgn54ksxmn8gljarjtxqnapv8kjnp4nrsll0sqv" \
	-e CONTRACT_ORACLE_ADDRESS="osmo1vhndln95yd7rngslzvf6sax6axcshkxqpmpr886ntelh28p9ghuqqgjjmc" \
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