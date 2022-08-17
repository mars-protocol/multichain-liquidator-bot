package collector

// WorkItem defines the parameters for the collector to use when querying
// the contract state
type WorkItem struct {
	RPCAddress         string `json:"rpc_address"`
	ContractAddress    string `json:"contract_address"`
	ContractItemPrefix string `json:"contract_item_prefix"`
	ContractPageOffset uint64 `json:"contract_page_offset"`
	ContractPageLimit  uint64 `json:"contract_page_limit"`
}
