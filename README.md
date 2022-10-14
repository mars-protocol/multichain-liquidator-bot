# Multichain liquidator bot

The multichain liquidator bot is a scalable liquidation bot that ensures accounts
are liquidated in a timely fashion.

The bot is composed of 4 distinct parts and more details are [available in this Notion document](https://www.notion.so/delphilabs/Query-Liquidation-Bot-d88aa1dfd0134ca88baa4c6add452fef)

1. Collector

The Collector service is responsible for fetching all the user addresses that
have debts in the Mars Red Bank and passes them on to the Health Checker. More info in [collector/README](collector/README.md)

2. Health Checker

Health Checker is responsible for fetching the health status for positions, 
and flagging unhealthy positions for liquidation. More info in [health-checker/README](health-checker/README.md)

3. Liquidator

The Liquidator service is responsible for handling liquidations of unhealthy positions. More info in [liquidator/README](liquidator/README.md)

4. Manager

The Manager service is responsible for ensuring all the data is processed within
a timeframe. By default, the timeframe is a single block. More info in [manager/README](manager/README.md)

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


## Deploying

### Docker

### AWS using Elastic Container Service (ECS)

The guide below does not provide the optimal security setup for the cluster, 
we recommend implementing your security parameters.

__Set up container registry__

You'll need the Docker images to be available to ECS by either pushing to a 
public registry or a private registry. You can learn more about setting up
and AWS container registry by visiting [the AWS ECR docs](https://aws.amazon.com/ecr/)

Add a repository for each service, and modify the `IMAGE_NAME` in each service's Makefile
to point to your own repositories.

You'll need repositories for the following services:

1. multichain-manager
2. multichain-collector
3. multichain-health-checker
4. multichain-liquidator

__Push images to container registry__

We provide convenience Makefiles for each service to ease compiling and building 
Docker containers. To build all the Docker images, use the top-level Makefile
by running `make docker_push` in the project root. This will compile the service,
build and push the Docker images to the remote repositories for each service.

> Note: You'll need to use the AWS and Docker CLI to log in to your AWS account. You can
> learn more in [the AWS docs](https://docs.aws.amazon.com/AmazonECR/latest/userguide/getting-started-cli.html)
>
> The command will look something like `aws ecr --region <your-region> get-login-password --profile <your-profile> | docker login --username AWS --password-stdin <your-ecr-registry-address>`

__Create an AWS ECS cluster__

You'll need to create a Fargate compatible cluster, known as a 'Networking only' cluster. More
can be found at the [documentation for ECS](https://aws.amazon.com/ecs/).


__Set up Redis__

We use Redis as a queue and cache for the service, you'll need to deploy a
small [ElastiCache cluster](https://aws.amazon.com/elasticache/)

You'll need to ensure:

1. It's a Redis cluster
2. Engine version: 6.2 or higher
3. Node type: cache.t4g.micro is sufficient

__Create and start the manager task__

The manager service is responsible for deploying the other services, however, it
can't deploy itself. Thus, the task and service for the manager is the only one
that needs to be created manually or via a tool such as 
[CloudFormation](https://aws.amazon.com/cloudformation/) or 
[HashiCorp's Terraform](https://www.terraform.io/)

1. Create the task definition
    - Select Fargate
    - Operating system family: Linux
    - Task memory: 1GB
    - Task CPU: 0.5vCPU

    - Add container
        - Soft memory limit: 256
        - No port mappings
        - Healthcheck: Not required
        - Environment variables: Set all variables specified in Makefile

            _Take special note of all the endpoints and be sure to use the Redis you configured earlier as well as the AWS keys you need to create and provide_
        - Start timeout: 30
        - Stop timeout: 30
        - Auto-configure CloudWatch Logs: Checked

2. Create service from task definition

    - Launch type: Fargate
    - Operating system family: Linux
    - Task definition: multichain-manager with the latest revision
    - Number of tasks: 1 (A single instance of the manager can manage tens of thousands of debt positions)
    - Minimum healthy percent: 100
    - Maximum percent: 200
    - Deployment circuit breaker: Disabled
    - Deployment type: Rolling update
    - Enable ECS managed tags: Checked
    - Auto-assign public IP: Enabled (disabling this will block the pulling of the container)
    - Service auto scaling: Do not adjust the service's desired count

3. Note: You'll need to provide the manager with a role ARN. You can create this manually or let AWS create it for you the first time that you create the manager definition. Once you created the definition for the manager you can find the role ARN under Task definition -> JSON. This needs to be added to the definition itself.

If everything was configured correctly your service should start. You can open the Manager's logs in CloudWatch -> Log Groups to see what it's doing.

