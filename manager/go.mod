module github.com/mars-protocol/multichain-liquidator-bot/monitor

go 1.18

replace github.com/mars-protocol/multichain-liquidator-bot/runtime => ../runtime

require (
	github.com/gorilla/websocket v1.5.0
	github.com/kelseyhightower/envconfig v1.4.0
	github.com/mars-protocol/multichain-liquidator-bot/runtime v0.0.0
	github.com/sirupsen/logrus v1.9.0
)

require (
	github.com/Microsoft/go-winio v0.5.2 // indirect
	github.com/docker/distribution v2.8.1+incompatible // indirect
	github.com/docker/docker v20.10.17+incompatible // indirect
	github.com/docker/go-connections v0.4.0 // indirect
	github.com/docker/go-units v0.4.0 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/gomodule/redigo v1.8.9 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.2 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	golang.org/x/net v0.0.0-20201021035429-f5854403a974 // indirect
	golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8 // indirect
)
