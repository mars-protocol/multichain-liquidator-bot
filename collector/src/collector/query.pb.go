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
func (*QueryAllContractStateRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_9677c207036b9f2b, []int{6}
}

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
func (*QueryAllContractStateResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_9677c207036b9f2b, []int{7}
}

type Model struct {
	// hex-encode key to read it better (this is often ascii)
	Key github_com_tendermint_tendermint_libs_bytes.HexBytes `protobuf:"bytes,1,opt,name=key,proto3,casttype=github.com/tendermint/tendermint/libs/bytes.HexBytes" json:"key,omitempty"`
	// base64-encode raw value
	Value []byte `protobuf:"bytes,2,opt,name=value,proto3" json:"value,omitempty"`
}

func (m *Model) Reset()         { *m = Model{} }
func (m *Model) String() string { return proto.CompactTextString(m) }
func (*Model) ProtoMessage()    {}
func (*Model) Descriptor() ([]byte, []int) {
	return fileDescriptor_e6155d98fa173e02, []int{7}
}

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
func (*PageRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_53d6d609fe6828af, []int{0}
}

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
func (*PageResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_53d6d609fe6828af, []int{1}
}

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

func init() {
	proto.RegisterType((*QueryAllContractStateRequest)(nil), "cosmwasm.wasm.v1.QueryAllContractStateRequest")
	proto.RegisterType((*QueryAllContractStateResponse)(nil), "cosmwasm.wasm.v1.QueryAllContractStateResponse")
	// TODO: Once we remove all the Cosmos SDK dependencies, we'll need to add these back
	// proto.RegisterType((*PageRequest)(nil), "cosmos.base.query.v1beta1.PageRequest")
	// proto.RegisterType((*PageResponse)(nil), "cosmos.base.query.v1beta1.PageResponse")
	proto.RegisterType((*Model)(nil), "cosmwasm.wasm.v1.Model")

}

func init() {
	proto.RegisterFile("cosmwasm/wasm/v1/query.proto", fileDescriptor_9677c207036b9f2b)
	proto.RegisterFile("cosmwasm/wasm/v1/types.proto", fileDescriptor_e6155d98fa173e02)
	proto.RegisterFile("cosmos/base/query/v1beta1/pagination.proto", fileDescriptor_53d6d609fe6828af)

}

var fileDescriptor_9677c207036b9f2b = []byte{
	// 1191 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0xbc, 0x97, 0xcf, 0x4f, 0x24, 0x45,
	0x14, 0xc7, 0xa7, 0xd8, 0x61, 0x7e, 0x14, 0x98, 0x1d, 0x2b, 0x0a, 0xe3, 0xc8, 0x76, 0x93, 0x76,
	0x83, 0x2c, 0x8b, 0xdd, 0xc2, 0x42, 0x56, 0x4d, 0x8c, 0xd9, 0x61, 0x75, 0x81, 0x84, 0x84, 0xed,
	0x8d, 0xd9, 0xc4, 0x3d, 0x90, 0x9a, 0xe9, 0x62, 0xe8, 0x84, 0xe9, 0x1a, 0xba, 0x0a, 0xd8, 0x09,
	0x41, 0xcd, 0x26, 0x1e, 0x4c, 0x8c, 0x9a, 0x18, 0x8f, 0x46, 0x0f, 0x66, 0xf5, 0xac, 0x37, 0xff,
	0x02, 0x8e, 0x24, 0x5e, 0x3c, 0x4d, 0x74, 0xf0, 0x60, 0xf8, 0x13, 0xf6, 0x64, 0xaa, 0xba, 0x7a,
	0xe8, 0xf9, 0xd1, 0xcc, 0xb0, 0x21, 0x7b, 0x21, 0xdd, 0xd4, 0xab, 0x57, 0x9f, 0xf7, 0xed, 0x57,
	0xef, 0xbd, 0x81, 0x13, 0x65, 0xca, 0xaa, 0xfb, 0x98, 0x55, 0x2d, 0xf9, 0x67, 0x6f, 0xce, 0xda,
	0xd9, 0x25, 0x7e, 0xdd, 0xac, 0xf9, 0x94, 0x53, 0x94, 0x0b, 0x57, 0x4d, 0xf9, 0x67, 0x6f, 0xae,
	0xf0, 0x4a, 0x85, 0x56, 0xa8, 0x5c, 0xb4, 0xc4, 0x53, 0x60, 0x57, 0xe8, 0xf6, 0xc2, 0xeb, 0x35,
	0xc2, 0xc2, 0xd5, 0x0a, 0xa5, 0x95, 0x6d, 0x62, 0xe1, 0x9a, 0x6b, 0x61, 0xcf, 0xa3, 0x1c, 0x73,
	0x97, 0x7a, 0xe1, 0xea, 0x8c, 0xd8, 0x4b, 0x99, 0x55, 0xc2, 0x8c, 0x04, 0x87, 0x5b, 0x7b, 0x73,
	0x25, 0xc2, 0xf1, 0x9c, 0x55, 0xc3, 0x15, 0xd7, 0x93, 0xc6, 0x81, 0xad, 0xb1, 0x00, 0xf3, 0xf7,
	0x85, 0xc5, 0x12, 0xf5, 0xb8, 0x8f, 0xcb, 0x7c, 0xc5, 0xdb, 0xa4, 0x36, 0xd9, 0xd9, 0x25, 0x8c,
	0xa3, 0x3c, 0x4c, 0x63, 0xc7, 0xf1, 0x09, 0x63, 0x79, 0x30, 0x09, 0xa6, 0xb3, 0x76, 0xf8, 0x6a,
	0x7c, 0x0d, 0xe0, 0x6b, 0x3d, 0xb6, 0xb1, 0x1a, 0xf5, 0x18, 0x89, 0xdf, 0x87, 0xee, 0xc3, 0x97,
	0xca, 0x6a, 0xc7, 0x86, 0xeb, 0x6d, 0xd2, 0xfc, 0xd0, 0x24, 0x98, 0x1e, 0x99, 0xd7, 0xcc, 0x4e,
	0x55, 0xcc, 0xa8, 0xe3, 0xe2, 0xe8, 0x51, 0x43, 0x4f, 0x1c, 0x37, 0x74, 0x70, 0xda, 0xd0, 0x13,
	0xf6, 0x68, 0x39, 0xb2, 0xf6, 0x5e, 0xf2, 0xbf, 0x9f, 0x74, 0x60, 0x7c, 0x06, 0x5f, 0x6f, 0xe3,
	0x59, 0x76, 0x19, 0xa7, 0x7e, 0xbd, 0x6f, 0x24, 0xe8, 0x23, 0x08, 0xcf, 0x34, 0x51, 0x38, 0x53,
	0x66, 0x20, 0xa0, 0x29, 0x04, 0x34, 0x83, 0xaf, 0xa7, 0x04, 0x34, 0xd7, 0x71, 0x85, 0x28, 0xaf,
	0x76, 0x64, 0xa7, 0xf1, 0x3b, 0x80, 0x13, 0xbd, 0x09, 0x94, 0x28, 0xab, 0x30, 0x4d, 0x3c, 0xee,
	0xbb, 0x44, 0x20, 0x5c, 0x99, 0x1e, 0x99, 0x9f, 0x89, 0x0f, 0x7a, 0x89, 0x3a, 0x44, 0xed, 0xff,
	0xd0, 0xe3, 0x7e, 0xbd, 0x98, 0x14, 0x02, 0xd8, 0xa1, 0x03, 0x74, 0xaf, 0x07, 0xf4, 0x9b, 0x7d,
	0xa1, 0x03, 0x90, 0x36, 0xea, 0x4f, 0x3b, 0x64, 0x63, 0xc5, 0xba, 0x38, 0x3b, 0x94, 0x6d, 0x1c,
	0xa6, 0xcb, 0xd4, 0x21, 0x1b, 0xae, 0x23, 0x65, 0x4b, 0xda, 0x29, 0xf1, 0xba, 0xe2, 0x5c, 0x9a,
	0x6a, 0x5f, 0x74, 0xaa, 0xd6, 0x02, 0x50, 0xaa, 0x4d, 0xc0, 0x6c, 0xf8, 0xb5, 0x03, 0xdd, 0xb2,
	0xf6, 0xd9, 0x3f, 0x2e, 0x4f, 0x87, 0xcf, 0x43, 0x8e, 0x3b, 0xdb, 0xdb, 0x21, 0xca, 0x03, 0x8e,
	0x39, 0x79, 0x71, 0x09, 0xf4, 0x23, 0x80, 0xd7, 0x62, 0x10, 0x94, 0x16, 0x8b, 0x30, 0x55, 0xa5,
	0x0e, 0xd9, 0x0e, 0x13, 0x68, 0xbc, 0x3b, 0x81, 0xd6, 0xc4, 0xba, 0xca, 0x16, 0x65, 0x7c, 0x79,
	0x22, 0x3d, 0x54, 0x1a, 0xd9, 0x78, 0xff, 0x82, 0x1a, 0x5d, 0x83, 0x50, 0x9e, 0xb1, 0xe1, 0x60,
	0x8e, 0x25, 0xc2, 0xa8, 0x9d, 0x95, 0xff, 0xb9, 0x8b, 0x39, 0x36, 0x6e, 0xa9, 0xc8, 0xbb, 0x1d,
	0xab, 0xc8, 0x11, 0x4c, 0xca, 0x9d, 0x40, 0xee, 0x94, 0xcf, 0xc6, 0x0e, 0xd4, 0xe4, 0xa6, 0x07,
	0x55, 0xec, 0xf3, 0x0b, 0xf2, 0x2c, 0x76, 0xf3, 0x14, 0xc7, 0x9e, 0x35, 0x74, 0x14, 0x21, 0x58,
	0x23, 0x8c, 0x09, 0x25, 0x22, 0x9c, 0x6b, 0x50, 0x8f, 0x3d, 0x52, 0x91, 0xce, 0x44, 0x49, 0x63,
	0x7d, 0x06, 0x11, 0xdc, 0x84, 0x39, 0x95, 0xfb, 0xfd, 0x6f, 0x9c, 0xf1, 0xc3, 0x10, 0xcc, 0x09,
	0xc3, 0xb6, 0x42, 0x7b, 0xa3, 0xc3, 0xba, 0x98, 0x6b, 0x36, 0xf4, 0x94, 0x34, 0xbb, 0x7b, 0xda,
	0xd0, 0x87, 0x5c, 0xa7, 0x75, 0x63, 0xf3, 0x30, 0x5d, 0xf6, 0x09, 0xe6, 0xd4, 0x97, 0xf1, 0x66,
	0xed, 0xf0, 0x15, 0x7d, 0x0c, 0xb3, 0x02, 0x67, 0x63, 0x0b, 0xb3, 0xad, 0xfc, 0x15, 0xc9, 0xfd,
	0xce, 0xb3, 0x86, 0xbe, 0x50, 0x71, 0xf9, 0xd6, 0x6e, 0xc9, 0x2c, 0xd3, 0xaa, 0xc5, 0x89, 0xe7,
	0x10, 0xbf, 0xea, 0x7a, 0x3c, 0xfa, 0xb8, 0xed, 0x96, 0x98, 0x55, 0xaa, 0x73, 0xc2, 0xcc, 0x65,
	0xf2, 0xb8, 0x28, 0x1e, 0xec, 0x8c, 0x70, 0xb5, 0x8c, 0xd9, 0x16, 0x7a, 0x04, 0xc7, 0x5c, 0x8f,
	0x71, 0xec, 0x71, 0x17, 0x73, 0xb2, 0x51, 0x13, 0x9b, 0x18, 0x13, 0x29, 0x98, 0x8a, 0xab, 0xf9,
	0x77, 0xca, 0x65, 0xc2, 0xd8, 0x12, 0xf5, 0x36, 0xdd, 0x8a, 0x4a, 0xe2, 0x57, 0x23, 0x3e, 0xd6,
	0x5b, 0x2e, 0x82, 0xa2, 0xbf, 0x9a, 0xcc, 0x24, 0x73, 0xc3, 0xab, 0xc9, 0xcc, 0x70, 0x2e, 0x65,
	0x3c, 0x01, 0xf0, 0xe5, 0x88, 0x9a, 0x4a, 0xa0, 0x15, 0x51, 0x3e, 0x84, 0x40, 0xa2, 0xd7, 0x00,
	0x79, 0xae, 0xd1, 0xab, 0xec, 0xb6, 0xeb, 0x5a, 0xcc, 0xb4, 0x7a, 0x4d, 0xa6, 0xac, 0xd6, 0xd0,
	0x84, 0xfa, 0xb2, 0x41, 0xb6, 0x64, 0x4e, 0x1b, 0xba, 0x7c, 0x0f, 0xbe, 0xa5, 0xea, 0x42, 0x8f,
	0x22, 0x0c, 0x2c, 0xfc, 0xa4, 0xed, 0x05, 0x02, 0x3c, 0x77, 0x81, 0x78, 0x0a, 0x20, 0x8a, 0x7a,
	0x57, 0x21, 0xde, 0x83, 0xb0, 0x15, 0x62, 0x58, 0x19, 0x06, 0x89, 0x31, 0xd0, 0x37, 0x1b, 0xc6,
	0x77, 0x89, 0x75, 0x02, 0xc3, 0x71, 0xc9, 0xb9, 0xee, 0x7a, 0x1e, 0x71, 0xce, 0xd1, 0xe2, 0xf9,
	0x8b, 0xe5, 0x37, 0x40, 0x8d, 0x2d, 0x6d, 0x67, 0xb4, 0xee, 0x60, 0x46, 0xdd, 0x8a, 0x40, 0x8f,
	0x64, 0xf1, 0xaa, 0x88, 0xb5, 0xd9, 0xd0, 0xd3, 0xc1, 0xd5, 0x60, 0x76, 0x3a, 0xb8, 0x15, 0x97,
	0x17, 0xf4, 0xfc, 0x97, 0x23, 0x70, 0x58, 0x12, 0xa1, 0xef, 0x01, 0x1c, 0x8d, 0x4e, 0x2f, 0xa8,
	0x47, 0xa3, 0x8f, 0x1b, 0xb9, 0x0a, 0x37, 0x07, 0xb2, 0x0d, 0xce, 0x37, 0x66, 0x9f, 0xfc, 0xf9,
	0xef, 0x77, 0x43, 0x53, 0xe8, 0xba, 0xd5, 0x35, 0x2c, 0x86, 0x3d, 0xd2, 0x3a, 0x50, 0x35, 0xef,
	0x10, 0x3d, 0x05, 0xf0, 0x6a, 0xc7, 0x70, 0x82, 0xde, 0xea, 0x73, 0x5c, 0xfb, 0x18, 0x55, 0x30,
	0x07, 0x35, 0x57, 0x80, 0x0b, 0x12, 0xd0, 0x44, 0xb3, 0x83, 0x00, 0x5a, 0x5b, 0x0a, 0xea, 0xe7,
	0x08, 0xa8, 0x9a, 0x07, 0xfa, 0x82, 0xb6, 0x0f, 0x2e, 0x7d, 0x41, 0x3b, 0xc6, 0x0c, 0x63, 0x5e,
	0x82, 0xce, 0xa2, 0x99, 0x5e, 0xa0, 0x0e, 0xb1, 0x0e, 0x54, 0x42, 0x1d, 0x5a, 0x67, 0xc3, 0xc7,
	0x2f, 0x00, 0xe6, 0x3a, 0x7b, 0x35, 0x8a, 0x3b, 0x38, 0x66, 0xae, 0x28, 0x58, 0x03, 0xdb, 0x0f,
	0x42, 0xda, 0x25, 0x29, 0x93, 0x50, 0xbf, 0x01, 0x98, 0xeb, 0xec, 0xad, 0xb1, 0xa4, 0x31, 0xdd,
	0x3d, 0x96, 0x34, 0xae, 0x69, 0x1b, 0xef, 0x4b, 0xd2, 0xdb, 0x68, 0x71, 0x20, 0x52, 0x1f, 0xef,
	0x5b, 0x07, 0x67, 0x4d, 0xf9, 0x10, 0xfd, 0x01, 0x20, 0xea, 0x6e, 0xb4, 0xe8, 0xed, 0x18, 0x8c,
	0xd8, 0x31, 0xa0, 0x30, 0x77, 0x81, 0x1d, 0x0a, 0xfd, 0x03, 0x89, 0xfe, 0x2e, 0xba, 0x3d, 0x98,
	0xc8, 0xc2, 0x51, 0x3b, 0x7c, 0x1d, 0x26, 0x65, 0xda, 0x1a, 0xb1, 0x79, 0x78, 0x96, 0xab, 0x6f,
	0x9c, 0x6b, 0xa3, 0x88, 0xa6, 0x25, 0x91, 0x81, 0x26, 0xfb, 0x25, 0x28, 0xf2, 0xe1, 0xb0, 0x2c,
	0x87, 0xe8, 0x3c, 0xbf, 0x61, 0x41, 0x2e, 0x5c, 0x3f, 0xdf, 0x48, 0x9d, 0xae, 0xc9, 0xd3, 0xf3,
	0x68, 0xac, 0xf7, 0xe9, 0xe8, 0x2b, 0x00, 0x47, 0x22, 0x95, 0x18, 0xdd, 0x88, 0xf1, 0xda, 0xdd,
	0x11, 0x0a, 0x33, 0x83, 0x98, 0x2a, 0x8c, 0x29, 0x89, 0x31, 0x89, 0xb4, 0xde, 0x18, 0xcc, 0xaa,
	0xc9, 0x4d, 0xc5, 0xe5, 0xa3, 0x7f, 0xb4, 0xc4, 0xaf, 0x4d, 0x2d, 0x71, 0xd4, 0xd4, 0xc0, 0x71,
	0x53, 0x03, 0x7f, 0x37, 0x35, 0xf0, 0xed, 0x89, 0x96, 0x38, 0x3e, 0xd1, 0x12, 0x7f, 0x9d, 0x68,
	0x89, 0x4f, 0xa6, 0x22, 0xc3, 0xcd, 0x12, 0x65, 0xd5, 0x87, 0xa1, 0x2f, 0xc7, 0x7a, 0x1c, 0xf8,
	0x94, 0xbf, 0xb6, 0x4b, 0x29, 0xf9, 0x23, 0xf9, 0xd6, 0xff, 0x01, 0x00, 0x00, 0xff, 0xff, 0xe8,
	0x7b, 0x25, 0x05, 0xd4, 0x0f, 0x00, 0x00,
}

var fileDescriptor_e6155d98fa173e02 = []byte{
	// 1123 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0x94, 0x56, 0xcd, 0x8f, 0xdb, 0x44,
	0x14, 0x8f, 0x93, 0xec, 0xd7, 0x34, 0x14, 0x77, 0xd8, 0xa5, 0x49, 0xa8, 0x9c, 0xd4, 0x14, 0xd8,
	0x7e, 0x25, 0x74, 0x41, 0x80, 0x7a, 0xa8, 0x94, 0x0f, 0xd3, 0xb8, 0x62, 0x93, 0x68, 0x92, 0x52,
	0x2d, 0x52, 0x65, 0x39, 0xf6, 0x6c, 0x62, 0xd5, 0xf1, 0x44, 0x9e, 0xc9, 0x36, 0xfe, 0x0f, 0x50,
	0x24, 0x04, 0x37, 0xb8, 0x44, 0x42, 0x80, 0x50, 0xff, 0x00, 0xae, 0xdc, 0x2b, 0x4e, 0x3d, 0x72,
	0x8a, 0x20, 0xbd, 0xc0, 0x75, 0x8f, 0xe5, 0x82, 0x3c, 0x93, 0x10, 0xab, 0xdd, 0x76, 0xc3, 0xc5,
	0xf2, 0xbc, 0xf7, 0x7e, 0xbf, 0xf7, 0xde, 0x6f, 0xde, 0xb3, 0x0c, 0x2e, 0x58, 0x84, 0xf6, 0x1f,
	0x9a, 0xb4, 0x5f, 0xe4, 0x8f, 0xa3, 0x1b, 0x45, 0x16, 0x0c, 0x30, 0x2d, 0x0c, 0x7c, 0xc2, 0x08,
	0x94, 0x17, 0xde, 0x02, 0x7f, 0x1c, 0xdd, 0xc8, 0x66, 0x42, 0x0b, 0xa1, 0x06, 0xf7, 0x17, 0xc5,
	0x41, 0x04, 0x67, 0xb7, 0xbb, 0xa4, 0x4b, 0x84, 0x3d, 0x7c, 0x9b, 0x5b, 0x33, 0x5d, 0x42, 0xba,
	0x2e, 0x2e, 0xf2, 0x53, 0x67, 0x78, 0x58, 0x34, 0xbd, 0x40, 0xb8, 0xd4, 0xfb, 0xe0, 0xf5, 0x92,
	0x65, 0x61, 0x4a, 0xdb, 0xc1, 0x00, 0x37, 0x4d, 0xdf, 0xec, 0xc3, 0x2a, 0x58, 0x3b, 0x32, 0xdd,
	0x21, 0x4e, 0x4b, 0x79, 0x69, 0xf7, 0xec, 0xde, 0x85, 0xc2, 0xf3, 0x05, 0x14, 0x96, 0x88, 0xb2,
	0x7c, 0x3c, 0xcd, 0xa5, 0x02, 0xb3, 0xef, 0xde, 0x54, 0x39, 0x48, 0x45, 0x02, 0x7c, 0x33, 0xf9,
	0xdd, 0xf7, 0x39, 0x49, 0xfd, 0x56, 0x02, 0x29, 0x11, 0x5d, 0x21, 0xde, 0xa1, 0xd3, 0x85, 0x2d,
	0x00, 0x06, 0xd8, 0xef, 0x3b, 0x94, 0x3a, 0xc4, 0x5b, 0x29, 0xc3, 0xce, 0xf1, 0x34, 0x77, 0x4e,
	0x64, 0x58, 0x22, 0x55, 0x14, 0xa1, 0x81, 0xd7, 0xc0, 0x86, 0x69, 0xdb, 0x3e, 0xa6, 0x34, 0x1d,
	0xcf, 0x4b, 0xbb, 0x5b, 0x65, 0x78, 0x3c, 0xcd, 0x9d, 0x15, 0x98, 0xb9, 0x43, 0x45, 0x8b, 0x90,
	0x79, 0x65, 0x5f, 0xc7, 0xc1, 0x3a, 0xef, 0x97, 0x42, 0x02, 0xa0, 0x45, 0x6c, 0x6c, 0x0c, 0x07,
	0x2e, 0x31, 0x6d, 0xc3, 0xe4, 0xb9, 0x79, 0x6d, 0x67, 0xf6, 0x94, 0x97, 0xd5, 0x26, 0xfa, 0x29,
	0x5f, 0x7c, 0x3c, 0xcd, 0xc5, 0x8e, 0xa7, 0xb9, 0x8c, 0xc8, 0xf6, 0x22, 0x8f, 0x8a, 0xe4, 0xd0,
	0x78, 0x97, 0xdb, 0x04, 0x14, 0x7e, 0x25, 0x01, 0xc5, 0xf1, 0x28, 0x33, 0x3d, 0xe6, 0x98, 0x0c,
	0x1b, 0x36, 0x3e, 0x34, 0x87, 0x2e, 0x33, 0x22, 0xca, 0xc4, 0x57, 0x50, 0xe6, 0xf2, 0xf1, 0x34,
	0xf7, 0x8e, 0xc8, 0xfb, 0x6a, 0x36, 0x15, 0x5d, 0x88, 0x04, 0x54, 0x85, 0xbf, 0xf9, 0x9f, 0x9b,
	0x2b, 0x12, 0x53, 0x7f, 0x90, 0xc0, 0x66, 0x85, 0xd8, 0x58, 0xf7, 0x0e, 0x09, 0x7c, 0x0b, 0x6c,
	0xf1, 0x5e, 0x7a, 0x26, 0xed, 0x71, 0x29, 0x52, 0x68, 0x33, 0x34, 0xd4, 0x4c, 0xda, 0x83, 0x69,
	0xb0, 0x61, 0xf9, 0xd8, 0x64, 0xc4, 0x17, 0x7a, 0xa3, 0xc5, 0x11, 0xb6, 0x00, 0x8c, 0x96, 0x62,
	0x71, 0x91, 0xd2, 0x6b, 0x2b, 0x49, 0x99, 0x0c, 0xa5, 0x44, 0xe7, 0x22, 0x78, 0xe1, 0xb8, 0x93,
	0xdc, 0x4c, 0xc8, 0xc9, 0x3b, 0xc9, 0xcd, 0xa4, 0xbc, 0xa6, 0xfe, 0x1a, 0x07, 0xa9, 0x0a, 0xf1,
	0x98, 0x6f, 0x5a, 0x8c, 0x17, 0xfa, 0x36, 0xd8, 0xe0, 0x85, 0x3a, 0x36, 0x2f, 0x33, 0x59, 0x06,
	0xb3, 0x69, 0x6e, 0x9d, 0xf7, 0x51, 0x45, 0xeb, 0xa1, 0x4b, 0xb7, 0x5f, 0x51, 0xf0, 0x36, 0x58,
	0x33, 0xed, 0xbe, 0xe3, 0xa5, 0x13, 0xdc, 0x2e, 0x0e, 0xa1, 0xd5, 0x35, 0x3b, 0xd8, 0x4d, 0x27,
	0x85, 0x95, 0x1f, 0xe0, 0xad, 0x39, 0x0b, 0xb6, 0xe7, 0x1d, 0x5d, 0x3a, 0xa1, 0xa3, 0x0e, 0x25,
	0xee, 0x90, 0xe1, 0xf6, 0xa8, 0x49, 0xa8, 0xc3, 0x1c, 0xe2, 0xa1, 0x05, 0x08, 0x5e, 0x07, 0x67,
	0x9c, 0x8e, 0x65, 0x0c, 0x88, 0xcf, 0xc2, 0x72, 0xd7, 0xf9, 0xa8, 0xbe, 0x36, 0x9b, 0xe6, 0xb6,
	0xf4, 0x72, 0xa5, 0x49, 0x7c, 0xa6, 0x57, 0xd1, 0x96, 0xd3, 0xb1, 0xf8, 0xab, 0x0d, 0xf7, 0xc1,
	0x16, 0x1e, 0x31, 0xec, 0xf1, 0x79, 0xd8, 0xe0, 0x09, 0xb7, 0x0b, 0x62, 0x93, 0x0b, 0x8b, 0x4d,
	0x2e, 0x94, 0xbc, 0xa0, 0x9c, 0xf9, 0xed, 0x97, 0xeb, 0x3b, 0x51, 0x51, 0xb4, 0x05, 0x0c, 0x2d,
	0x19, 0x6e, 0x26, 0xff, 0x0a, 0xc7, 0xfe, 0x1f, 0x09, 0xa4, 0x17, 0xa1, 0xa1, 0x48, 0x35, 0x87,
	0x32, 0xe2, 0x07, 0x9a, 0xc7, 0xfc, 0x00, 0x36, 0xc1, 0x16, 0x19, 0x60, 0xdf, 0x64, 0xcb, 0xdd,
	0xdc, 0x7b, 0xb1, 0xc5, 0x13, 0xe0, 0x8d, 0x05, 0x2a, 0x9c, 0x4b, 0xb4, 0x24, 0x89, 0xde, 0x4e,
	0xfc, 0xa5, 0xb7, 0x73, 0x0b, 0x6c, 0x0c, 0x07, 0x36, 0xd7, 0x35, 0xf1, 0x7f, 0x74, 0x9d, 0x83,
	0xe0, 0x2e, 0x48, 0xf4, 0x69, 0x97, 0xdf, 0x55, 0xaa, 0xfc, 0xe6, 0xb3, 0x69, 0x0e, 0x22, 0xf3,
	0xe1, 0xa2, 0xca, 0x7d, 0x4c, 0xa9, 0xd9, 0xc5, 0x28, 0x0c, 0x51, 0x11, 0x80, 0x2f, 0x12, 0xc1,
	0x8b, 0x20, 0xd5, 0x71, 0x89, 0xf5, 0xc0, 0xe8, 0x61, 0xa7, 0xdb, 0x63, 0x62, 0x8e, 0xd0, 0x19,
	0x6e, 0xab, 0x71, 0x13, 0xcc, 0x80, 0x4d, 0x36, 0x32, 0x1c, 0xcf, 0xc6, 0x23, 0xd1, 0x08, 0xda,
	0x60, 0x23, 0x3d, 0x3c, 0xaa, 0x0e, 0x58, 0xdb, 0x27, 0x36, 0x76, 0xe1, 0x1d, 0x90, 0x78, 0x80,
	0x03, 0xb1, 0x2c, 0xe5, 0x4f, 0x9e, 0x4d, 0x73, 0x1f, 0x76, 0x1d, 0xd6, 0x1b, 0x76, 0x0a, 0x16,
	0xe9, 0x17, 0x19, 0xf6, 0xec, 0x70, 0xe1, 0x3c, 0x16, 0x7d, 0x75, 0x9d, 0x0e, 0x2d, 0x76, 0x02,
	0x86, 0x69, 0xa1, 0x86, 0x47, 0xe5, 0xf0, 0x05, 0x85, 0x24, 0xe1, 0x00, 0x8a, 0x6f, 0x70, 0x9c,
	0xaf, 0x9e, 0x38, 0x5c, 0xf9, 0x5b, 0x02, 0x60, 0xb9, 0xff, 0xf0, 0x23, 0x70, 0xbe, 0x54, 0xa9,
	0x68, 0xad, 0x96, 0xd1, 0x3e, 0x68, 0x6a, 0xc6, 0xdd, 0x7a, 0xab, 0xa9, 0x55, 0xf4, 0x4f, 0x75,
	0xad, 0x2a, 0xc7, 0xb2, 0x99, 0xf1, 0x24, 0xbf, 0xb3, 0x0c, 0xbe, 0xeb, 0xd1, 0x01, 0xb6, 0x9c,
	0x43, 0x07, 0xdb, 0xf0, 0x1a, 0x80, 0x51, 0x5c, 0xbd, 0x51, 0x6e, 0x54, 0x0f, 0x64, 0x29, 0xbb,
	0x3d, 0x9e, 0xe4, 0xe5, 0x25, 0xa4, 0x4e, 0x3a, 0xc4, 0x0e, 0xe0, 0xc7, 0x20, 0x1d, 0x8d, 0x6e,
	0xd4, 0x3f, 0x3b, 0x30, 0x4a, 0xd5, 0x2a, 0xd2, 0x5a, 0x2d, 0x39, 0xfe, 0x7c, 0x9a, 0x86, 0xe7,
	0x06, 0x25, 0xf1, 0x9d, 0x85, 0x7b, 0x60, 0x27, 0x0a, 0xd4, 0x3e, 0xd7, 0xd0, 0x01, 0xcf, 0x94,
	0xc8, 0x9e, 0x1f, 0x4f, 0xf2, 0x6f, 0x2c, 0x51, 0xda, 0x11, 0xf6, 0x83, 0x30, 0x59, 0x76, 0xf3,
	0xcb, 0x1f, 0x95, 0xd8, 0xa3, 0x9f, 0x94, 0xd8, 0x95, 0x9f, 0x13, 0x20, 0x7f, 0xda, 0xa4, 0x41,
	0x0c, 0xde, 0xaf, 0x34, 0xea, 0x6d, 0x54, 0xaa, 0xb4, 0x8d, 0x4a, 0xa3, 0xaa, 0x19, 0x35, 0xbd,
	0xd5, 0x6e, 0xa0, 0x03, 0xa3, 0xd1, 0xd4, 0x50, 0xa9, 0xad, 0x37, 0xea, 0x27, 0x49, 0x53, 0x1c,
	0x4f, 0xf2, 0x57, 0x4f, 0xe3, 0x8e, 0x0a, 0x76, 0x0f, 0x5c, 0x5e, 0x29, 0x8d, 0x5e, 0xd7, 0xdb,
	0xb2, 0x94, 0xdd, 0x1d, 0x4f, 0xf2, 0x97, 0x4e, 0xe3, 0xd7, 0x3d, 0x87, 0xc1, 0xfb, 0xe0, 0xda,
	0x4a, 0xc4, 0xfb, 0xfa, 0x6d, 0x54, 0x6a, 0x6b, 0x72, 0x3c, 0x7b, 0x75, 0x3c, 0xc9, 0xbf, 0x77,
	0x1a, 0xf7, 0xbe, 0xd3, 0xf5, 0x4d, 0x86, 0x57, 0xa6, 0xbf, 0xad, 0xd5, 0xb5, 0x96, 0xde, 0x92,
	0x13, 0xab, 0xd1, 0xdf, 0xc6, 0x1e, 0xa6, 0x0e, 0xcd, 0x26, 0xc3, 0xcb, 0x2a, 0xd7, 0x1e, 0xff,
	0xa9, 0xc4, 0x1e, 0xcd, 0x14, 0xe9, 0xf1, 0x4c, 0x91, 0x9e, 0xcc, 0x14, 0xe9, 0x8f, 0x99, 0x22,
	0x7d, 0xf3, 0x54, 0x89, 0x3d, 0x79, 0xaa, 0xc4, 0x7e, 0x7f, 0xaa, 0xc4, 0xbe, 0x78, 0x37, 0xb2,
	0x07, 0x15, 0x42, 0xfb, 0xf7, 0x16, 0xbf, 0x3a, 0x76, 0x71, 0x24, 0x7e, 0x79, 0xf8, 0xff, 0x4e,
	0x67, 0x9d, 0x7f, 0xd5, 0x3e, 0xf8, 0x37, 0x00, 0x00, 0xff, 0xff, 0x21, 0x8c, 0xa0, 0x70, 0x10,
	0x09, 0x00, 0x00,
}

var fileDescriptor_53d6d609fe6828af = []byte{
	// 282 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0x44, 0x90, 0xbd, 0x4e, 0xc3, 0x30,
	0x14, 0x85, 0x6b, 0xfa, 0x2b, 0xb7, 0x03, 0xb2, 0x10, 0x72, 0x17, 0x13, 0x75, 0x8a, 0x90, 0x88,
	0x55, 0xf1, 0x00, 0x48, 0x5d, 0x59, 0x50, 0xc4, 0xc4, 0x52, 0x39, 0xe1, 0x36, 0x44, 0x6d, 0xe2,
	0x34, 0xbe, 0xa9, 0xc8, 0x1b, 0x30, 0xf2, 0x58, 0x8c, 0x1d, 0x19, 0x51, 0xf2, 0x22, 0x28, 0x76,
	0x10, 0x93, 0xfd, 0x9d, 0x7b, 0x74, 0xef, 0xd1, 0xa1, 0xb7, 0xb1, 0x36, 0x99, 0x36, 0x32, 0x52,
	0x06, 0xe4, 0xb1, 0x82, 0xb2, 0x96, 0xa7, 0x75, 0x04, 0xa8, 0xd6, 0xb2, 0x50, 0x49, 0x9a, 0x2b,
	0x4c, 0x75, 0x1e, 0x14, 0xa5, 0x46, 0xcd, 0x96, 0xce, 0x1b, 0x74, 0xde, 0xc0, 0x7a, 0x83, 0xde,
	0xbb, 0xfa, 0x20, 0x74, 0xfe, 0xa4, 0x12, 0x08, 0xe1, 0x58, 0x81, 0x41, 0x76, 0x49, 0x87, 0x7b,
	0xa8, 0x39, 0xf1, 0x88, 0xbf, 0x08, 0xbb, 0x2f, 0xbb, 0xa6, 0x13, 0xbd, 0xdb, 0x19, 0x40, 0x7e,
	0xe1, 0x11, 0x7f, 0x14, 0xf6, 0xc4, 0xae, 0xe8, 0xf8, 0x90, 0x66, 0x29, 0xf2, 0xa1, 0x95, 0x1d,
	0xb0, 0x1b, 0x3a, 0x8f, 0x75, 0x95, 0xe3, 0x16, 0x35, 0xaa, 0x03, 0x1f, 0x79, 0xc4, 0x9f, 0x85,
	0xd4, 0x4a, 0xcf, 0x9d, 0xc2, 0x38, 0x9d, 0x96, 0x70, 0x82, 0xd2, 0x00, 0x1f, 0xdb, 0xe1, 0x1f,
	0xae, 0x1e, 0xe8, 0xc2, 0x25, 0x31, 0x85, 0xce, 0x0d, 0xb0, 0x25, 0x9d, 0xe5, 0xf0, 0x8e, 0xdb,
	0xff, 0x3c, 0xd3, 0x8e, 0x1f, 0xa1, 0xee, 0x6e, 0xbb, 0xfd, 0x2e, 0x92, 0x83, 0xcd, 0xe6, 0xab,
	0x11, 0xe4, 0xdc, 0x08, 0xf2, 0xd3, 0x08, 0xf2, 0xd9, 0x8a, 0xc1, 0xb9, 0x15, 0x83, 0xef, 0x56,
	0x0c, 0x5e, 0xfc, 0x24, 0xc5, 0xb7, 0x2a, 0x0a, 0x62, 0x9d, 0xc9, 0xbe, 0x37, 0xf7, 0xdc, 0x99,
	0xd7, 0xbd, 0xc4, 0xba, 0x00, 0xe3, 0x3a, 0x8c, 0x26, 0xb6, 0xb1, 0xfb, 0xdf, 0x00, 0x00, 0x00,
	0xff, 0xff, 0x3d, 0x43, 0x85, 0xf7, 0x5f, 0x01, 0x00, 0x00,
}