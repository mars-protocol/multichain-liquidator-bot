package collector

// Note: These types are extracted from various CosmWasm and Cosmos SDK types
// to reduce the amount of dependencies we need to parse simple messages

import (
	proto "github.com/gogo/protobuf/proto"
	github_com_tendermint_tendermint_libs_bytes "github.com/tendermint/tendermint/libs/bytes"
)

// This is a compile-time assertion to ensure that this generated file
// is compatible with the proto package it is being compiled against.
// A compilation error at this line likely means your copy of the
// proto package needs to be updated.
const _ = proto.GoGoProtoPackageIsVersion3 // please upgrade the proto package

// QueryAllContractStateRequest is the request type for the
// Query/AllContractState RPC method
type QueryAllContractStateRequest struct {
	// address is the address of the contract
	Address string `protobuf:"bytes,1,opt,name=address,proto3" json:"address,omitempty"`
	// pagination defines an optional pagination for the request.
	Pagination *PageRequest `protobuf:"bytes,2,opt,name=pagination,proto3" json:"pagination,omitempty"`
}

func (m *QueryAllContractStateRequest) Reset()         { *m = QueryAllContractStateRequest{} }
func (m *QueryAllContractStateRequest) String() string { return proto.CompactTextString(m) }
func (*QueryAllContractStateRequest) ProtoMessage()    {}

// QueryAllContractStateResponse is the response type for the
// Query/AllContractState RPC method
type QueryAllContractStateResponse struct {
	Models []Model `protobuf:"bytes,1,rep,name=models,proto3" json:"models"`
	// pagination defines the pagination in the response.
	Pagination *PageResponse `protobuf:"bytes,2,opt,name=pagination,proto3" json:"pagination,omitempty"`
}

func (m *QueryAllContractStateResponse) Reset()         { *m = QueryAllContractStateResponse{} }
func (m *QueryAllContractStateResponse) String() string { return proto.CompactTextString(m) }
func (*QueryAllContractStateResponse) ProtoMessage()    {}

type Model struct {
	// hex-encode key to read it better (this is often ascii)
	Key github_com_tendermint_tendermint_libs_bytes.HexBytes `protobuf:"bytes,1,opt,name=key,proto3,casttype=github.com/tendermint/tendermint/libs/bytes.HexBytes" json:"key,omitempty"`
	// base64-encode raw value
	Value []byte `protobuf:"bytes,2,opt,name=value,proto3" json:"value,omitempty"`
}

func (m *Model) Reset()         { *m = Model{} }
func (m *Model) String() string { return proto.CompactTextString(m) }
func (*Model) ProtoMessage()    {}

// PageRequest is to be embedded in gRPC request messages for efficient
// pagination. Ex:
//
//  message SomeRequest {
//          Foo some_parameter = 1;
//          PageRequest pagination = 2;
//  }
type PageRequest struct {
	// key is a value returned in PageResponse.next_key to begin
	// querying the next page most efficiently. Only one of offset or key
	// should be set.
	Key []byte `protobuf:"bytes,1,opt,name=key,proto3" json:"key,omitempty"`
	// offset is a numeric offset that can be used when key is unavailable.
	// It is less efficient than using key. Only one of offset or key should
	// be set.
	Offset uint64 `protobuf:"varint,2,opt,name=offset,proto3" json:"offset,omitempty"`
	// limit is the total number of results to be returned in the result page.
	// If left empty it will default to a value to be set by each app.
	Limit uint64 `protobuf:"varint,3,opt,name=limit,proto3" json:"limit,omitempty"`
	// count_total is set to true  to indicate that the result set should include
	// a count of the total number of items available for pagination in UIs.
	// count_total is only respected when offset is used. It is ignored when key
	// is set.
	CountTotal bool `protobuf:"varint,4,opt,name=count_total,json=countTotal,proto3" json:"count_total,omitempty"`
	// reverse is set to true if results are to be returned in the descending order.
	//
	// Since: cosmos-sdk 0.43
	Reverse bool `protobuf:"varint,5,opt,name=reverse,proto3" json:"reverse,omitempty"`
}

func (m *PageRequest) Reset()         { *m = PageRequest{} }
func (m *PageRequest) String() string { return proto.CompactTextString(m) }
func (*PageRequest) ProtoMessage()    {}

func (m *PageRequest) GetKey() []byte {
	if m != nil {
		return m.Key
	}
	return nil
}

func (m *PageRequest) GetOffset() uint64 {
	if m != nil {
		return m.Offset
	}
	return 0
}

func (m *PageRequest) GetLimit() uint64 {
	if m != nil {
		return m.Limit
	}
	return 0
}

func (m *PageRequest) GetCountTotal() bool {
	if m != nil {
		return m.CountTotal
	}
	return false
}

func (m *PageRequest) GetReverse() bool {
	if m != nil {
		return m.Reverse
	}
	return false
}

// PageResponse is to be embedded in gRPC response messages where the
// corresponding request message has used PageRequest.
//
//  message SomeResponse {
//          repeated Bar results = 1;
//          PageResponse page = 2;
//  }
type PageResponse struct {
	// next_key is the key to be passed to PageRequest.key to
	// query the next page most efficiently
	NextKey []byte `protobuf:"bytes,1,opt,name=next_key,json=nextKey,proto3" json:"next_key,omitempty"`
	// total is total number of results available if PageRequest.count_total
	// was set, its value is undefined otherwise
	Total uint64 `protobuf:"varint,2,opt,name=total,proto3" json:"total,omitempty"`
}

func (m *PageResponse) Reset()         { *m = PageResponse{} }
func (m *PageResponse) String() string { return proto.CompactTextString(m) }
func (*PageResponse) ProtoMessage()    {}

func (m *PageResponse) GetNextKey() []byte {
	if m != nil {
		return m.NextKey
	}
	return nil
}

func (m *PageResponse) GetTotal() uint64 {
	if m != nil {
		return m.Total
	}
	return 0
}
