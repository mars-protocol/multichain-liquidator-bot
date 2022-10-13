package deployer

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/ecs"
	"github.com/aws/aws-sdk-go-v2/service/ecs/types"
	"github.com/kelseyhightower/envconfig"
	"github.com/sirupsen/logrus"
)

// AWSECS implements a deployment mechanism using AWS Elastic container service
// as the orchestrator
// If uses Fargate as the launcher with Linux as the operating system
type AWSECS struct {
	service      string
	container    string
	containerEnv map[string]string

	client            *ecs.Client
	clusterARN        string
	taskDefinitionARN string
	serviceARN        string

	logger *logrus.Entry
}

// awsECSConfig specifies the environment config for AWS
type awsECSConfig struct {
	ClusterARN     string   `envconfig:"AWS_CLUSTER_ARN" required:"true"`
	CpuUnits       int      `envconfig:"AWS_SERVICE_CPU_UNITS" required:"true"`
	MemoryMB       int      `envconfig:"AWS_SERVICE_MEMORY_MB" required:"true"`
	Subnets        []string `envconfig:"AWS_SERVICE_SUBNETS" required:"true"`
	SecurityGroups []string `envconfig:"AWS_SERVICE_SECURITY_GROUPS" required:"true"`
}

// NewAWSECS creates a new instance of the AWS ECS deployer that will deploy
// the given container in the specified cluster
func NewAWSECS(
	service string,
	container string,
	containerEnv map[string]string,
	logger *logrus.Entry,
) (*AWSECS, error) {

	var ecsConfig awsECSConfig
	err := envconfig.Process("", &ecsConfig)
	if err != nil {
		return nil, fmt.Errorf("unable to process AWS ECS config: %s", err)
	}

	// Loads the config from the following environment variables
	// AWS_ACCESS_KEY_ID
	// AWS_SECRET_ACCESS_KEY
	awsConfig, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		return nil, err
	}

	client := ecs.NewFromConfig(awsConfig)

	// No environment variables specified
	if containerEnv == nil {
		containerEnv = make(map[string]string)
	}

	// Get or create the AWS ECS task definition for the ECS service deployment
	taskDefinitionARN, err := getOrCreateTaskDefinition(
		client,
		service,
		container,
		ecsConfig.CpuUnits,
		ecsConfig.MemoryMB,
		containerEnv,
	)
	if err != nil {
		return nil, err
	}

	serviceARN, err := getOrCreateService(
		client,
		ecsConfig.ClusterARN,
		service,
		ecsConfig.Subnets,
		ecsConfig.SecurityGroups,
		taskDefinitionARN,
	)
	if err != nil {
		return nil, err
	}

	return &AWSECS{
		service:           service,
		container:         container,
		containerEnv:      containerEnv,
		client:            client,
		clusterARN:        ecsConfig.ClusterARN,
		taskDefinitionARN: taskDefinitionARN,
		serviceARN:        serviceARN,
		logger: logger.WithFields(logrus.Fields{
			"subservice": "deployer",
			"type":       "aws-ecs",
		}),
	}, nil
}

// Increase the number of services deployed
func (dep *AWSECS) Increase() error {
	if dep.IsDeploying() {
		return errors.New("unable to increase while deployment is in progress")
	}

	// Increase the desired count for the service
	service, err := getService(dep.client, dep.clusterARN, dep.service)
	if err != nil {
		return err
	}

	// Set AWS call timeout to 10 seconds
	ctx, cancel := context.WithTimeout(context.TODO(), time.Second*10)
	defer cancel()

	requestedServiceCount := service.RunningCount + 1
	dep.client.UpdateService(ctx, &ecs.UpdateServiceInput{
		DesiredCount: aws.Int32(requestedServiceCount),
	})

	dep.logger.WithFields(logrus.Fields{
		"name":           dep.service,
		"total_services": requestedServiceCount,
	}).Info("Deployed new instance")

	return nil
}

// Decrease the number of services deployed
func (dep *AWSECS) Decrease() error {
	if dep.IsDeploying() {
		return errors.New("unable to decrease while deployment is in progress")
	}

	// Decrease the desired count for the service
	service, err := getService(dep.client, dep.clusterARN, dep.service)
	if err != nil {
		return err
	}

	// Set AWS call timeout to 10 seconds
	ctx, cancel := context.WithTimeout(context.TODO(), time.Second*10)
	defer cancel()

	requestedServiceCount := service.RunningCount - 1
	dep.client.UpdateService(ctx, &ecs.UpdateServiceInput{
		DesiredCount: aws.Int32(requestedServiceCount),
	})

	dep.logger.WithFields(logrus.Fields{
		"name":           dep.service,
		"total_services": requestedServiceCount,
	}).Info("Removed deployed instance")

	return nil
}

// RemoveAll removes all the services from deployment
func (dep *AWSECS) RemoveAll() error {

	// Decrease the desired count for the service to 0
	service, err := getService(dep.client, dep.clusterARN, dep.service)
	if err != nil {
		return err
	}

	// Set AWS call timeout to 10 seconds
	ctx, cancel := context.WithTimeout(context.TODO(), time.Second*10)
	defer cancel()

	requestedServiceCount := 0
	dep.client.UpdateService(ctx, &ecs.UpdateServiceInput{
		DesiredCount: aws.Int32(int32(requestedServiceCount)),
	})

	dep.logger.WithFields(logrus.Fields{
		"removed":        service.RunningCount,
		"total_services": requestedServiceCount,
	}).Info("Removed all deployed instances")
	return nil
}

// Count returns the amount of services deployed
func (dep *AWSECS) Count() (int, error) {
	service, err := getService(dep.client, dep.clusterARN, dep.service)
	if err != nil {
		return 0, err
	}

	return int(service.RunningCount), nil
}

// IsDeploying returns true while an increase or decrease of services have
// been requested but not completed yet
func (dep *AWSECS) IsDeploying() bool {

	service, err := getService(dep.client, dep.clusterARN, dep.service)
	if err != nil {
		return false
	}

	// If we have a pending count, it means we are still deploying
	return service.PendingCount != 0
}

// getOrCreateTaskDefinition gets the task definition for the service. If it
// doesn't exist it is created
func getOrCreateTaskDefinition(
	client *ecs.Client,
	service string,
	container string,
	cpuUnits int,
	memoryMB int,
	containerEnv map[string]string,
) (string, error) {
	// Check if we have a task definition already
	// 10 second AWS timeout
	ctx, cancel := context.WithTimeout(context.TODO(), time.Second*10)
	defer cancel()
	taskDefinition, err := client.DescribeTaskDefinition(
		ctx,
		&ecs.DescribeTaskDefinitionInput{
			TaskDefinition: &service,
		})
	if err != nil {

		// Add environment variables
		var env []types.KeyValuePair
		for key, value := range containerEnv {
			// env = append(env, fmt.Sprintf("%s=%s", key, value))
			env = append(env, types.KeyValuePair{
				Name:  aws.String(key),
				Value: aws.String(value),
			})
		}

		// If we get an error we most likely don't have a task definition
		// deployed yet, so we create a new one
		ctx, cancel = context.WithTimeout(context.TODO(), time.Second*10)
		defer cancel()
		registerTaskDefinition, err := client.RegisterTaskDefinition(
			ctx,
			&ecs.RegisterTaskDefinitionInput{
				ContainerDefinitions: []types.ContainerDefinition{
					{
						Name:        aws.String(service),
						Image:       aws.String(container),
						Cpu:         *aws.Int32(int32(cpuUnits)),
						Memory:      aws.Int32(int32(memoryMB)),
						Environment: env,
					},
				},
				RuntimePlatform: &types.RuntimePlatform{
					OperatingSystemFamily: types.OSFamilyLinux,
					CpuArchitecture:       types.CPUArchitectureX8664,
				},
				Cpu:         aws.String(strconv.Itoa(cpuUnits)),
				Memory:      aws.String(strconv.Itoa(memoryMB)),
				NetworkMode: types.NetworkModeAwsvpc,
				Family:      aws.String(service),
				TaskRoleArn: aws.String(""),
				RequiresCompatibilities: []types.Compatibility{
					types.CompatibilityFargate,
				},
			})
		if err != nil {
			// We don't have a task definition and we can't create one, so
			// we cannot run
			return "", err
		}

		// Definition registered
		return aws.ToString(registerTaskDefinition.TaskDefinition.TaskDefinitionArn), nil
	}
	// Already exists
	return aws.ToString(taskDefinition.TaskDefinition.TaskDefinitionArn), nil

}

// getOrCreateService gets the service in the cluster. If it doesn't exist
// it is created
func getOrCreateService(
	client *ecs.Client,
	clusterARN string,
	serviceName string,
	subnets []string,
	securityGroups []string,
	taskDefinitionARN string,
) (string, error) {

	service, err := getService(client, clusterARN, serviceName)
	if err != nil {
		// 10 second timeout for AWS calls
		ctx, cancel := context.WithTimeout(context.TODO(), time.Second*10)
		defer cancel()

		// Unable to find service, create it instead
		service, err := client.CreateService(ctx, &ecs.CreateServiceInput{
			ServiceName: aws.String(serviceName),
			Cluster:     aws.String(clusterARN),
			// Be default we launch with no instances, the scaler should
			// determine the count
			DesiredCount: aws.Int32(0),
			LaunchType:   types.LaunchTypeFargate,
			DeploymentConfiguration: &types.DeploymentConfiguration{
				// 100% means hte service is kept alive at all times
				MinimumHealthyPercent: aws.Int32(100),
				// 200% means we could double the deployment count of a service
				// should we be upgrading the service (rolling)
				MaximumPercent: aws.Int32(200),
			},
			DeploymentController: &types.DeploymentController{
				Type: types.DeploymentControllerTypeEcs,
			},
			EnableECSManagedTags: true,
			SchedulingStrategy:   types.SchedulingStrategyReplica,
			TaskDefinition:       aws.String(taskDefinitionARN),
			NetworkConfiguration: &types.NetworkConfiguration{
				AwsvpcConfiguration: &types.AwsVpcConfiguration{
					Subnets: subnets,
					// We need an IP assigned (even though it is inaccesssible)
					// in order to fetch container images
					AssignPublicIp: types.AssignPublicIpEnabled,
					SecurityGroups: securityGroups,
				},
			},
		})
		if err != nil {
			return "", err
		}
		// Service registered
		return aws.ToString(service.Service.ServiceArn), nil
	}
	// Existing service
	return aws.ToString(service.ServiceArn), nil
}

// getService retrieves the service in the given cluster and returns it if
// it exists
func getService(
	client *ecs.Client,
	clusterARN string,
	serviceName string,
) (types.Service, error) {

	// 10 second timeout for AWS calls
	ctx, cancel := context.WithTimeout(context.TODO(), time.Second*10)
	defer cancel()

	servicesDetails, err := client.DescribeServices(
		ctx,
		&ecs.DescribeServicesInput{
			Services: []string{serviceName},
			Cluster:  aws.String(clusterARN),
		})
	if err == nil {
		for _, service := range servicesDetails.Services {
			// We only query a single service, we should only receive a single item
			// if it exists
			return service, nil
		}
	}

	return types.Service{}, errors.New("unable to find service in cluster")
}
