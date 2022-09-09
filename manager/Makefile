#
# A Makefile to build, run and test Go code
#

.PHONY: default build fmt lint run run_race test clean vet docker_build docker_run docker_clean .start_redis

IMAGE_NAME := "multichain-manager:latest"
GIT_COMMIT := $(shell git rev-list -1 HEAD)

# This makes the APP_NAME be the name of the current directory
# Ex. in path /home/dev/app/my-app the APP_NAME will be set to my-app
APP_NAME := $(notdir $(CURDIR))

.start_redis: ## Start Redis if it isn't running
ifeq ($(shell docker ps | grep redis:latest 2> /dev/null),)
	docker run --name redis-bot --rm -p 6379:6379 -d redis:latest
endif

default: build ## Default: Build the binary for the service

dependencies: ## Install dependencies for the service
	docker pull redis
	go mod tidy

build: ## Build the binary for the service
	CGO_ENABLED=0 go build -o ./bin/${APP_NAME} ./src/*.go

run: build .start_redis ## Build and run the service binary
	# Add your environment variable here
	LOG_LEVEL=debug \
	LOG_FORMAT=text \
	SERVICE_NAME="bot-manager" \
	CHAIN_ID="osmosis-1" \
	HIVE_ENDPOINT="https://phoenix-hive.terra.dev/graphql" \
	RPC_ENDPOINT="https://phoenix-rpc.terra.dev:443" \
	RPC_WEBSOCKET_ENDPOINT="wss://rpc.osmosis.zone/websocket" \
	REDIS_DATABASE=0 \
	REDIS_ENDPOINT="127.0.0.1:6379" \
	COLLECTOR_QUEUE_NAME="collector" \
	HEALTH_CHECK_QUEUE_NAME="health_check" \
	EXECUTOR_QUEUE_NAME="executor" \
	DEPLOYER_TYPE="docker" \
	COLLECTOR_IMAGE=redis:latest \
	HEALTH_CHECKER_IMAGE=redis:latest \
	EXECUTOR_IMAGE=redis:latest \
	SCALING_TYPE="watermark" \
	COLLECTOR_CONTRACT="osmo123" \
	AWS_ACCESS_KEY_ID="AKIAYCXJKTF2S35NVQD7" \
	AWS_SECRET_ACCESS_KEY="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" \
	AWS_CLUSTER_ARN="arn:aws:ecs:us-east-1:555613854069:cluster/test-cluster" \
	AWS_SERVICE_CPU_UNITS=512 \
	AWS_SERVICE_MEMORY_MB=1024 \
	AWS_SERVICE_SUBNETS="subnet-14ef644c" \
	AWS_SERVICE_SECURITY_GROUPS="sg-cbdefbb3" \
	COLLECTOR_CONFIG='{"LOG_LEVEL": "debug","LOG_FORMAT": "text","SERVICE_NAME": "bot-collector","CHAIN_ID": "pisco-1","REDIS_DATABASE": "0","REDIS_ENDPOINT":"127.0.0.1:6379","COLLECTOR_QUEUE_NAME":"collector","HEALTH_CHECK_QUEUE_NAME": "health_check"}' \
	HEALTH_CHECKER_CONFIG='{"REDIS_ENDPOINT":"127.0.0.1","REDIS_DATABASE":"0","HEALTH_CHECK_QUEUE_NAME":"health_check","LIQUIDATOR_QUEUE_NAME":"liquidator","HIVE_ENDPOINT":"https://phoenix-hive.terra.dev","REDBANK_ADDRESS":"osmo123","ADDRESS_PER_JOB":"5","JOBS_PER_WORKER":"2","BATCH_SIZE":"2"}' \
	EXECUTOR_CONFIG='{"LIQUIDATION_QUEUE_NAME":"liquidator","PREFIX":"osmo","GAS_PRICE":"0.001osmo","RPC_ENDPOINT":"https://phoenix-rpc.terra.dev","LIQUIDATION_FILTERER_CONTRACT":"osmo12...32","SEED":"seed phrase here"}' \
	./bin/${APP_NAME}

run_race: .start_redis ## Run the service with race condition checking enabled
	# Add your environment variable here
	LOG_LEVEL=debug \
	LOG_FORMAT=text \
	SERVICE_NAME="bot-manager" \
	CHAIN_ID="osmosis-1" \
	HIVE_ENDPOINT="https://phoenix-hive.terra.dev/graphql" \
	RPC_ENDPOINT="https://phoenix-rpc.terra.dev" \
	RPC_WEBSOCKET_ENDPOINT="wss://rpc.osmosis.zone/websocket" \
	REDIS_DATABASE=0 \
	REDIS_ENDPOINT="127.0.0.1:6379" \
	COLLECTOR_QUEUE_NAME="collector" \
	HEALTH_CHECK_QUEUE_NAME="health_check" \
	EXECUTOR_QUEUE_NAME="executor" \
	go run -race ./src/*.go

docker_build: build ## Build the service Docker container
	docker build -t ${IMAGE_NAME} .

docker_run: ## Run the Docker container in interactive mode
	docker run -it --rm --network="host" \
		-e LOG_LEVEL=debug \
		-e LOG_FORMAT=text \
		-e SERVICE_NAME="bot-manager" \
		-e CHAIN_ID="pisco-1" \
		${IMAGE_NAME}

docker_push: ## Push the Docker container to the registry
	docker push ${IMAGE_NAME}

fmt: ## Format the code using `go fmt`
	go fmt ./...

test: ## Run the tests
	go test ./... -v

test_cover: ## Run tests with a coverage report
	go test ./... -v -cover -covermode=count -coverprofile=./coverage.out

test_cover_view: test_cover ## Run tests with coverage report and open HTML view
	go tool cover -html=coverage.out

clean: ## Remove compiled binaries from bin/
	rm ./bin/*

help: ## Display this help screen
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	