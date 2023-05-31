import { sleep } from "../helpers";
import { Pool } from "../types/Pool";
import { PoolDataProviderInterface } from "./PoolDataProviderInterface";
import fetch from 'cross-fetch'

// 
// Pair type definitions
//
interface Token {
    contract_addr: string;
  }

  interface NativeToken {
    denom: string;
  }
  
interface AssetInfoNative {
    native_token: NativeToken;
}

interface AssetInfo {
    token : Token
}

  
interface PairType {
    xyk: {};
}
  
interface Pair {
    asset_infos: AssetInfoNative[] | AssetInfo[];
    contract_addr: string;
    liquidity_token: string;
    pair_type: PairType;
}

interface ContractQuery {
    pairs: Pair[];
}

interface Wasm {
    contractQuery: ContractQuery;
}

interface Data {
    wasm: Wasm;
}

interface ResponseData {
    data: Data;
}

//
// Pool type definition
//

export class AstroportPoolProvider implements PoolDataProviderInterface {
    
    private pairContracts : string[] = []
    
    constructor(
        private astroportFactory: string,
        private graphqlEndpoint : string,
    ) {}
    
    initiate = async () => {
        this.pairContracts = await this.fetchPairContracts(this.astroportFactory)

        // refresh contracts every 30 minutes
        setInterval(this.fetchPairContracts, 1000 * 60 * 30)
    }
    
   loadPools = async ():Promise<Pool[]>  => {
        
        if (this.pairContracts.length === 0) {
            console.log("Pools not yet loaded, waiting 15 seconds...")

            await sleep(15000)

            if (this.pairContracts.length === 0) {
                throw new Error("Pools still not loaded. Ensure you have called initiate()")
            }
        }

        const poolQuery = `
            query($contractAddress: String!){
                wasm {
                    contractQuery(contractAddress:$contractAddress, query: {
                        pool: {}
                    }
                }
            }
        `

        // dispatch graphql request to fetch details for every pair
        const poolQueryBatch = this.pairContracts.map((contract) => {
            return {
                query : poolQuery,
                variables : { contractAddress : contract }
            }
        })

        // execute the query
        // 


        // batchedQueries: queries.map(({ query, variables }) => ({ query, variables }))
        return []
    }

    async fetchPairContracts(contractAddress: string, limit = 10): Promise<string[]> {
        let startAfter = null
        let retries = 0
        const maxRetries = 8
        

        const contracts : string[] = []

        while (retries < maxRetries) {
            try {
                const variables : Record<string, any> = {
                    contractAddress,
                    limit
                }

                const query = `
                query ($contractAddress: String!, $limit: Int!){
                    wasm {
                        contractQuery(
                            contractAddress: $contractAddress, 
                            query: {
                                pairs: {
                                        limit: $limit
                                        start_after: ${startAfter}
                                    }
                            }
                        )
                    }
                }
            ` 

            const response = await fetch(this.graphqlEndpoint, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: query, variables: variables }),
            });
        
            const responseData : ResponseData = await response.json();
        
            const pairs = responseData.data.wasm.contractQuery.pairs
                                .filter((pair) => pair.pair_type.xyk !== undefined)
            
            if (pairs.length === 0) {
                return contracts
            } else {
                pairs.forEach((pair) => {
                    contracts.push(pair.contract_addr)
                })

                let assets = pairs[pairs.length - 1].asset_infos
                startAfter = `[
                    ${this.produceStartAfterAsset(assets[0])},
                    ${this.produceStartAfterAsset(assets[1])}
                ]`
                console.log(startAfter)
            }

            } catch (error) {
            console.error(error);
            retries += 1
            }
        }

        
        return contracts
    }

    private produceStartAfterAsset = (asset : AssetInfo | AssetInfoNative) => { 
        if ("token" in asset) {
            return `{
                token: {
                    contract_addr: "${asset.token.contract_addr}"
                }
            }`
        } else {
            return `{
                native_token: {
                    denom: "${asset.native_token.denom}"
                }
            }`
        }
    }
}