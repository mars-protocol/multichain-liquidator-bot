package runtime

// BaseConfig defines the environment variables needed by all services
type BaseConfig struct {
	LogFormat   string `envconfig:"LOG_FORMAT" required:"true"`
	LogLevel    string `envconfig:"LOG_LEVEL" required:"true"`
	ServiceName string `envconfig:"SERVICE_NAME" required:"true"`
}
