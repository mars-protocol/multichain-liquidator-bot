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
	CHAIN_ID="localosmosis" \
	HIVE_ENDPOINT="http://127.0.0.1:8080/graphql " \
	LCD_ENDPOINT="http://127.0.0.1:12317" \
	RPC_ENDPOINT="http://127.0.0.1:26657" \
	RPC_WEBSOCKET_ENDPOINT="ws://127.0.0.1:26657/websocket" \
	REDIS_DATABASE=0 \
	REDIS_METRICS_DATABASE=0 \
	REDIS_ENDPOINT="127.0.0.1:6379" \
	COLLECTOR_QUEUE_NAME="collector" \
	COLLECTOR_ITEMS_PER_PACKET=4000 \
	HEALTH_CHECK_QUEUE_NAME="health_check" \
	EXECUTOR_QUEUE_NAME="executor" \
	DEPLOYER_TYPE="docker" \
	COLLECTOR_IMAGE=multichain-collector:latest \
	HEALTH_CHECKER_IMAGE=multichain-health-checker:latest \
	EXECUTOR_IMAGE=multichain-liquidator:latest \
	SCALING_TYPE="watermark" \
	COLLECTOR_CONTRACT="osmo1fyr2mptjswz4w6xmgnpgm93x0q4s4wdl6srv3rtz3utc4f6fmxeqfjmkr6" \
	AWS_ACCESS_KEY_ID="AKIAYCXJKTF2S35NVQD7" \
	AWS_SECRET_ACCESS_KEY="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" \
	AWS_CLUSTER_ARN="arn:aws:ecs:us-east-1:555613854069:cluster/test-cluster" \
	AWS_SERVICE_CPU_UNITS=512 \
	AWS_SERVICE_MEMORY_MB=1024 \
	AWS_SERVICE_SUBNETS="subnet-14ef644c" \
	AWS_SERVICE_SECURITY_GROUPS="sg-cbdefbb3" \
	COLLECTOR_CONFIG='{"LOG_LEVEL": "debug","LOG_FORMAT": "text","SERVICE_NAME": "bot-collector","CHAIN_ID": "localosmosis","REDIS_DATABASE": "0", "REDIS_METRICS_DATABASE": "0","REDIS_ENDPOINT":"127.0.0.1:6379","COLLECTOR_QUEUE_NAME":"collector","HEALTH_CHECK_QUEUE_NAME": "health_check"}' \
	HEALTH_CHECKER_CONFIG='{"LOG_LEVEL": "debug","LOG_FORMAT": "text","SERVICE_NAME": "bot-health-checker","CHAIN_ID": "localosmosis","REDIS_ENDPOINT":"127.0.0.1:6379","REDIS_DATABASE":"0","REDIS_METRICS_DATABASE":"0","HEALTH_CHECK_QUEUE_NAME":"health_check","LIQUIDATOR_QUEUE_NAME":"liquidator","HIVE_ENDPOINT":"http://127.0.0.1:8080/graphql","REDBANK_ADDRESS":"osmo1fyr2mptjswz4w6xmgnpgm93x0q4s4wdl6srv3rtz3utc4f6fmxeqfjmkr6","ADDRESS_PER_JOB":"1","JOBS_PER_WORKER":"1","BATCH_SIZE":"1"}' \
	EXECUTOR_CONFIG='{"GAS_PRICE": "1uosmo","RPC_ENDPOINT": "http://localhost:26657","SEED": "notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer rew genius","ACCOUNTS_PER_SEED": "100","RPC_URL": "http://localhost:26657","QUEUE_NAME": "throughput_test","LIQUIDATION_QUEUE_NAME": "executor","ATOM_DENOM": "uion","OSMO_DENOM": "uosmo","MAX_THREADS": "20","OUTPOST_ARTIFACTS_PATH": "/Users/<usernamezz>/outposts/artifacts/","CHAIN_ID": "localosmosis"}' \
	METRICS_ENABLED=false \
	DD_SITE="us5.datadoghq.com" \
	DD_API_KEY="f1ffedda9de19cf4cef2ae80f2b6e210" \
	./bin/${APP_NAME}

run_race: .start_redis ## Run the service with race condition checking enabled
	# Add your environment variable here
	LOG_LEVEL=debug \
	LOG_FORMAT=text \
	SERVICE_NAME="bot-manager" \
	CHAIN_ID="phoenix-1" \
	HIVE_ENDPOINT="https://terra2-delphi-1.simply-vc.com.mt/ZC79CHN02DSI/terra-hive/graphql " \
	LCD_ENDPOINT="http://127.0.0.1:12317" \
	RPC_ENDPOINT="http://127.0.0.1:26657" \
	RPC_WEBSOCKET_ENDPOINT="ws://127.0.0.1:26657/websocket" \
	REDIS_DATABASE=0 \
	REDIS_METRICS_DATABASE=0 \
	REDIS_ENDPOINT="127.0.0.1:6379" \
	COLLECTOR_QUEUE_NAME="collector" \
	COLLECTOR_ITEMS_PER_PACKET=4000 \
	HEALTH_CHECK_QUEUE_NAME="health_check" \
	EXECUTOR_QUEUE_NAME="executor" \
	DEPLOYER_TYPE="docker" \
	COLLECTOR_IMAGE=redis:latest \
	HEALTH_CHECKER_IMAGE=redis:latest \
	EXECUTOR_IMAGE=redis:latest \
	SCALING_TYPE="watermark" \
	COLLECTOR_CONTRACT="osmo1fyr2mptjswz4w6xmgnpgm93x0q4s4wdl6srv3rtz3utc4f6fmxeqfjmkr6" \
	AWS_ACCESS_KEY_ID="AKIAYCXJKTF2S35NVQD7" \
	AWS_SECRET_ACCESS_KEY="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" \
	AWS_CLUSTER_ARN="arn:aws:ecs:us-east-1:555613854069:cluster/test-cluster" \
	AWS_SERVICE_CPU_UNITS=512 \
	AWS_SERVICE_MEMORY_MB=1024 \
	AWS_SERVICE_SUBNETS="subnet-14ef644c" \
	AWS_SERVICE_SECURITY_GROUPS="sg-cbdefbb3" \
	COLLECTOR_CONFIG='{"LOG_LEVEL": "debug","LOG_FORMAT": "text","SERVICE_NAME": "bot-collector","CHAIN_ID": "localosmosis","REDIS_DATABASE": "0","REDIS_ENDPOINT":"127.0.0.1:6379","COLLECTOR_QUEUE_NAME":"collector","HEALTH_CHECK_QUEUE_NAME": "health_check"}' \
	HEALTH_CHECKER_CONFIG='{"REDIS_ENDPOINT":"127.0.0.1","REDIS_DATABASE":"0","HEALTH_CHECK_QUEUE_NAME":"health_check","LIQUIDATOR_QUEUE_NAME":"liquidator","HIVE_ENDPOINT":"https://phoenix-hive.terra.dev","REDBANK_ADDRESS":"osmo123","ADDRESS_PER_JOB":"5","JOBS_PER_WORKER":"2","BATCH_SIZE":"2"}' \
	EXECUTOR_CONFIG='{"LIQUIDATION_QUEUE_NAME":"liquidator","PREFIX":"osmo","GAS_PRICE":"0.001osmo","RPC_ENDPOINT":"https://phoenix-rpc.terra.dev","LIQUIDATION_FILTERER_CONTRACT":"osmo12...32","SEED":"seed phrase here"}' \
	METRICS_ENABLED=false \
	DD_SITE="us5.datadoghq.com" \
	DD_API_KEY="f1ffedda9de19cf4cef2ae80f2b6e210" \
	go run -race ./src/*.go

docker_build: build ## Build the service Docker container
	docker build -t ${IMAGE_NAME} .

docker_run: ## Run the Docker container in interactive mode
	docker run -it --rm --network="host" \
		# Add your environment variable here
		-e LOG_LEVEL=debug \
		-e LOG_FORMAT=text \
		-e SERVICE_NAME="bot-manager" \
		-e CHAIN_ID="phoenix-1" \
		-e HIVE_ENDPOINT="https://terra2-delphi-1.simply-vc.com.mt/ZC79CHN02DSI/terra-hive/graphql " \
		-e LCD_ENDPOINT="http://127.0.0.1:12317" \
		-e RPC_ENDPOINT="http://127.0.0.1:26657" \
		-e RPC_WEBSOCKET_ENDPOINT="ws://127.0.0.1:26657/websocket" \
		-e REDIS_DATABASE=0 \
		-e REDIS_METRICS_DATABASE=0 \
		-e REDIS_ENDPOINT="127.0.0.1:6379" \
		-e COLLECTOR_QUEUE_NAME="collector" \
		-e COLLECTOR_ITEMS_PER_PACKET=4000 \
		-e HEALTH_CHECK_QUEUE_NAME="health_check" \
		-e EXECUTOR_QUEUE_NAME="executor" \
		-e DEPLOYER_TYPE="docker" \
		-e COLLECTOR_IMAGE=redis:latest \
		-e HEALTH_CHECKER_IMAGE=redis:latest \
		-e EXECUTOR_IMAGE=redis:latest \
		-e SCALING_TYPE="watermark" \
		-e COLLECTOR_CONTRACT="osmo1fyr2mptjswz4w6xmgnpgm93x0q4s4wdl6srv3rtz3utc4f6fmxeqfjmkr6" \
		-e AWS_ACCESS_KEY_ID="AKIAYCXJKTF2S35NVQD7" \
		-e AWS_SECRET_ACCESS_KEY="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" \
		-e AWS_CLUSTER_ARN="arn:aws:ecs:us-east-1:555613854069:cluster/test-cluster" \
		-e AWS_SERVICE_CPU_UNITS=512 \
		-e AWS_SERVICE_MEMORY_MB=1024 \
		-e AWS_SERVICE_SUBNETS="subnet-14ef644c" \
		-e AWS_SERVICE_SECURITY_GROUPS="sg-cbdefbb3" \
		-e COLLECTOR_CONFIG='{"LOG_LEVEL": "debug","LOG_FORMAT": "text","SERVICE_NAME": "bot-collector","CHAIN_ID": "localosmosis","REDIS_DATABASE": "0","REDIS_ENDPOINT":"127.0.0.1:6379","COLLECTOR_QUEUE_NAME":"collector","HEALTH_CHECK_QUEUE_NAME": "health_check"}' \
		-e HEALTH_CHECKER_CONFIG='{"REDIS_ENDPOINT":"127.0.0.1","REDIS_DATABASE":"0","HEALTH_CHECK_QUEUE_NAME":"health_check","LIQUIDATOR_QUEUE_NAME":"liquidator","HIVE_ENDPOINT":"https://phoenix-hive.terra.dev","REDBANK_ADDRESS":"osmo123","ADDRESS_PER_JOB":"5","JOBS_PER_WORKER":"2","BATCH_SIZE":"2"}' \
		-e EXECUTOR_CONFIG='{"LIQUIDATION_QUEUE_NAME":"liquidator","PREFIX":"osmo","GAS_PRICE":"0.001osmo","RPC_ENDPOINT":"https://phoenix-rpc.terra.dev","LIQUIDATION_FILTERER_CONTRACT":"osmo12...32","SEED":"seed phrase here"}' \
		-e METRICS_ENABLED=false \
		-e DD_SITE="us5.datadoghq.com" \
		-e DD_API_KEY="f1ffedda9de19cf4cef2ae80f2b6e210" \
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
	