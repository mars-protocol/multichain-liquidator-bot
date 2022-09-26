package manager

import "time"

// Metric contains a single metric to be reported
type Metric struct {
	Name      string
	Value     float64
	Timestamp int64
	Chain     string
}

// RPCMethodRequest defines the JSON structure of requests via the RPC websocket
type RPCMethodRequest struct {
	JSONRPC string `json:"jsonrpc"`
	Method  string `json:"method"`
	ID      int    `json:"id"`
	Params  Params `json:"params"`
}

type Params struct {
	Query string `json:"query"`
}

// RPCNewBlockResponse defines the JSON structure of new block events received
// via RPC websocket
type RPCNewBlockResponse struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Result  struct {
		Query string `json:"query"`
		Data  struct {
			Type  string `json:"type"`
			Value struct {
				Block struct {
					Header struct {
						Version struct {
							Block string `json:"block"`
							App   string `json:"app"`
						} `json:"version"`
						ChainID string    `json:"chain_id"`
						Height  string    `json:"height"`
						Time    time.Time `json:"time"`
					} `json:"header"`
				} `json:"block"`
			} `json:"value"`
		} `json:"data"`
	} `json:"result"`
}
