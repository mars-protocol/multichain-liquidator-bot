#
# A Makefile to build, run and test all the services
#

.PHONY: default build fmt lint run test clean vet docker_build

default: build ## Build the binary

build: ## Build all the services
	cd manager && make
	# cd collector && make
	# cd health-checker && make
	# cd liquidator && make

docker_build: build ## Build all the services' Docker images
	cd manager && make docker_build
	# cd collector && make docker_build
	# cd health-checker && make docker_build
	# cd liquidator && make docker_build

docker_push: docker_build ## Build all the services' Docker images
	cd manager && make docker_push
	# cd collector && make docker_push
	# cd health-checker && make docker_push
	# cd liquidator && make docker_push

run: docker_build ## Build Docker images and start manager
	cd manager && make run

test: ## Run the tests
	echo "TODO"

test_cover: ## Run tests with a coverage report
	echo "TODO"

clean: ## Remove compiled binaries from bin/
	cd collector && make clean
	cd health-checker && make clean
	cd liquidator && make clean
	cd manager && make clean

help: ## Display this help screen
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'