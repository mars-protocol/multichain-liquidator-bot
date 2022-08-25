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
	github.com/gomodule/redigo v1.8.9 // indirect
	golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8 // indirect
)
