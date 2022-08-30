module github.com/mars-protocol/multichain-liquidator-bot/manager

go 1.18

replace github.com/mars-protocol/multichain-liquidator-bot/runtime => ../runtime

require (
	github.com/docker/docker v20.10.17+incompatible
	github.com/google/uuid v1.3.0
	github.com/gorilla/websocket v1.5.0
	github.com/kelseyhightower/envconfig v1.4.0
	github.com/mars-protocol/multichain-liquidator-bot/runtime v0.0.0
	github.com/opencontainers/image-spec v1.0.2
	github.com/sirupsen/logrus v1.9.0
)

require (
	github.com/Microsoft/go-winio v0.5.2 // indirect
	github.com/docker/distribution v2.8.1+incompatible // indirect
	github.com/docker/go-connections v0.4.0 // indirect
	github.com/docker/go-units v0.4.0 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/gomodule/redigo v1.8.9 // indirect
	github.com/moby/term v0.0.0-20220808134915-39b0c02b01ae // indirect
	github.com/morikuni/aec v1.0.0 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/rafaeljusto/redigomock/v3 v3.1.1 // indirect
	golang.org/x/net v0.0.0-20201021035429-f5854403a974 // indirect
	golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8 // indirect
	golang.org/x/time v0.0.0-20220722155302-e5dcc9cfc0b9 // indirect
	gotest.tools/v3 v3.3.0 // indirect
)
