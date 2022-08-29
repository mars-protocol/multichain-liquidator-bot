package manager

import (
	"encoding/json"
	"sync/atomic"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// newBlockReceiver connects to the given websocket and listens for new blocks.
// When a new block is received, it is sent via the new block channel
func (service *Manager) newBlockReceiver(
	rpcWebsocketEndpoint string,
) (chan RPCNewBlockResponse, error) {
	newBlockChan := make(chan RPCNewBlockResponse)

	// Set up the websocket connection
	client, _, err := websocket.DefaultDialer.Dial(rpcWebsocketEndpoint, nil)
	if err != nil {
		return nil, err
	}
	service.logger.Info("Websocket connected")

	// Construct the request to subscribe to new block events
	subscribeRequest := RPCMethodRequest{
		JSONRPC: "2.0",
		Method:  "subscribe",
		ID:      0,
		Params: Params{
			Query: "tm.event='NewBlock'",
		},
	}
	subscribeRequestJSON, err := json.Marshal(subscribeRequest)
	if err != nil {
		return nil, err
	}

	// Send the subscribe request
	err = client.WriteMessage(websocket.TextMessage, subscribeRequestJSON)
	if err != nil {
		return nil, err
	}

	go func() {
		defer func() {
			// Close the websocket connection
			client.Close()
			// Close the channel we're sending blocks on
			close(newBlockChan)
			service.logger.Warning("Websocket disconnected")
		}()

		// Read from the websocket forever
		for atomic.LoadUint32(&service.continueRunning) == 1 {
			_, message, err := client.ReadMessage()
			if err != nil {
				// Fail fast if we're unable to read from the websocket
				service.logger.WithFields(logrus.Fields{
					"err": err,
				}).Fatal("Unable to read new block from websocket")
			}
			// Parse the incoming block JSON
			// We only parse the absolutely necessary fields in the packet
			// to avoid any parsing errors should any non-essential information
			// be missing or in a different format than expected
			var newBlock RPCNewBlockResponse
			err = json.Unmarshal(message, &newBlock)
			if err != nil {
				service.logger.WithFields(logrus.Fields{
					"err": err,
				}).Fatal("Unable to parse new block from websocket")
			}
			// Subscribe/Unsubscribe events from RPC produce empty result blocks
			// so we filter those out to avoid *thinking* there is a new block
			// when there isn't
			if newBlock.Result != (RPCNewBlockResponse{}.Result) {
				service.logger.WithFields(logrus.Fields{
					"height":    newBlock.Result.Data.Value.Block.Header.Height,
					"timestamp": newBlock.Result.Data.Value.Block.Header.Time,
				}).Debug("New block received from websocket")
				newBlockChan <- newBlock
			}
		}
	}()

	return newBlockChan, nil
}
