export interface Token {
    contract_addr: string;
  }
  
  export interface NativeToken {
    denom: string;
  }
  
  export interface AssetInfoNative {
    native_token: NativeToken;
  }
  
  export interface AssetInfoCW {
    token: Token;
  }
  
  export interface PairType {
    xyk: {};
  }
  
  export interface Pair {
    asset_infos: AssetInfoNative[] | AssetInfoCW[];
    contract_addr: string;
    liquidity_token: string;
    pair_type: PairType;
  }
  
  export interface ContractQueryPairs {
    pairs: Pair[];
  }
  
  export interface Wasm {
    contractQuery: ContractQueryPairs | ContractQueryPool;
  }
  
  export interface Data {
    wasm: Wasm;
  }
  
  export interface ResponseData {
    data: Data;
  }
  
  //
  // Pool type definition
  //
  
  export interface PoolResponseData {
    data: ContractQueryPool
  }
  
  export interface Asset {
    info: AssetInfoCW | AssetInfoNative
    amount: string
  }
  
  export interface ContractQueryPool {
    assets: Asset[]
    total_share: string
  }

  //
  // GraphQL 
  //
  export interface Query {
    query: string
    variables?: Record<string, any>;
  }


export interface PoolQueryResponse {
	contractAddress: string
	result: PoolResponseData
}
  