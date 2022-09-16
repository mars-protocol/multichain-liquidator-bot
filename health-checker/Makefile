#
# A Makefile to build, run and test Go code
#

.PHONY: default build fmt lint run run_race test clean vet docker_build docker_run docker_clean

IMAGE_NAME := "multichain-collector:latest"
GIT_COMMIT := $(shell git rev-list -1 HEAD)

# This makes the APP_NAME be the name of the current directory
# Ex. in path /home/dev/app/my-app the APP_NAME will be set to my-app
APP_NAME := $(notdir $(CURDIR))

default: build ## Default: Build the binary for the service

dependencies: ## Install dependencies for the service
	go mod tidy

build: ## Build the binary for the service
	CGO_ENABLED=0 go build -o ./bin/${APP_NAME} ./src/*.go

run: build ## Build and run the service binary
	# Add your environment variable here
	LOG_LEVEL=debug \
	LOG_FORMAT=text \
	SERVICE_NAME="bot-collector" \
	CHAIN_ID="pisco-1" \
	REDIS_METRICS_DATABASE="0" \
	./bin/${APP_NAME}

run_race: ## Run the service with race condition checking enabled
	# Add your environment variable here
	LOG_LEVEL=debug \
	LOG_FORMAT=text \
	SERVICE_NAME="bot-collector" \
	CHAIN_ID="pisco-1" \
	go run -race ./src/*.go

docker_build: build ## Build the service Docker container
	docker build -t ${IMAGE_NAME} .

docker_run: ## Run the Docker container in interactive mode
	docker run -it --rm --network="host" \
		-e LOG_LEVEL=debug \
		-e LOG_FORMAT=text \
		-e SERVICE_NAME="bot-collector" \
		-e CHAIN_ID="pisco-1" \
		${IMAGE_NAME}

docker_push: ## Push the Docker container to the registry
	docker push ${IMAGE_NAME}

fmt: ## Format the code using `go fmt`
	go fmt ./...

test: ## Run the tests
	go test ./...

test_cover: ## Run tests with a coverage report
	go test ./... -v -cover -covermode=count -coverprofile=./coverage.out

clean: ## Remove compiled binaries from bin/
	rm ./bin/*

help: ## Display this help screen
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'