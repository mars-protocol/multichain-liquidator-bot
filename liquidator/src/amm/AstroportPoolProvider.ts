import { sleep } from "../helpers";
import { Pool, PoolAsset } from "../types/Pool";
import { PoolDataProviderInterface } from "./PoolDataProviderInterface";
import fetch from 'cross-fetch'
import { Asset, AssetInfo, AssetInfoNative, ContractQueryPairs, ContractQueryPool, Pair, PoolResponseData, Query, ResponseData } from "./types/AstroportTypes";

export class AstroportPoolProvider implements PoolDataProviderInterface {
    
    private maxRetries = 8

    private pairs : Pair[] = []
    
    constructor(
        private astroportFactory: string,
        private graphqlEndpoint : string,
    ) {}
    
    initiate = async () => {
        this.pairs = await this.fetchPairContracts(this.astroportFactory)

        // refresh pool contracts every 30 minutes
        setInterval(this.fetchPairContracts, 1000 * 60 * 30)
    }

    setPairs = (pairs: Pair[]) => {
        this.pairs = pairs
    }

    getPairs = () : Pair[] => {
        return this.pairs
    }
    
   loadPools = async ():Promise<Pool[]>  => {
        let retries = 0    

        if (this.pairs.length === 0) {
            throw new Error("Pools still not loaded. Ensure you have called initiate()")
        }

        const poolQueries = this.pairs.map((pair) => this.producePoolQuery(pair) )
        

        // execute the query
        while (retries < this.maxRetries) {
            try {
                const response = await fetch(this.graphqlEndpoint, {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(poolQueries),
                });
         
                const responseData : PoolResponseData[] =await response.json()
        
                return responseData.map((poolResponse, index) => {
        
                    // Our address is our key. We add this in to our graphql queries so we can identify the correct pool
                    const address : string = Object.keys(poolResponse.data)[0]
        
                    const queryData : ContractQueryPool = poolResponse.data[address]!.contractQuery
                    const pool : Pool = {
                        address : address,
                        id : index as unknown as Long,
                        poolAssets : this.producePoolAssets(queryData.assets),
                        swapFee : "0.00",
                    }
        
                    return pool
                })
            } catch(err) {
                console.error(err)
                retries += 1
                await sleep(1000)
            }
        }

        return []
    }

    async fetchPairContracts(contractAddress: string, limit = 10): Promise<Pair[]> {
        let startAfter = this.findLatestPair(this.pairs)
        let retries = 0

        const pairs : Pair[] = []

        // Loop until we find all the assets or we hit our max retries
        while (retries < this.maxRetries) {
            try {
            
            const query = this.producePairQuery(startAfter, limit, contractAddress)

            const response = await fetch(this.graphqlEndpoint, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });
        
            // get our data
            const responseData : ResponseData = await response.json();
            const contractQueryData = responseData.data.wasm.contractQuery as ContractQueryPairs

            // Filter out pairs that are not XYK
            const batchPairs = contractQueryData.pairs
                                .filter((pair) => pair.pair_type.xyk !== undefined)
            
            if (batchPairs.length === 0) {
                // we have no more pairs to load
                return pairs
            } else {

                batchPairs.forEach((pair) => {
                    pairs.push(pair)
                })

                let assets = pairs[pairs.length - 1].asset_infos
                startAfter = `[
                    ${this.produceStartAfterAsset(assets[0])},
                    ${this.produceStartAfterAsset(assets[1])}
                ]`
            }

            } catch (error) {
                console.error(error);
                retries += 1
                await sleep(1000)
            }
        }

        return pairs
    }

    private producePoolQuery = (pair : Pair) : Query => {

        const poolQuery = `
            query($contractAddress: String!){
                ${pair.contract_addr}:wasm {
                    contractQuery(contractAddress:$contractAddress, query: {
                        pool: {}
                    })
                }
            }
        `
        return {
            query : poolQuery,
            variables : { contractAddress : pair.contract_addr }
        }
     }

     private producePairQuery = (startAfter : string | null, limit : number, contractAddress: string) : Query => {
    
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

        return { query : query, variables : variables  }
    }


    private findLatestPair = (pairs : Pair[]) : string | null => {
        if (pairs.length === 0) {
            return null
        }
        const latestAssetInfos = this.pairs[this.pairs.length - 1].asset_infos

        let startAfter = `[
                    ${this.produceStartAfterAsset(latestAssetInfos[0])},
                    ${this.produceStartAfterAsset(latestAssetInfos[1])}
        ]`

        return startAfter
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

    producePoolAssets = (assets : Asset[]) : PoolAsset[] => { 

        return assets.map((asset) => {
            if ("token" in asset.info) {
                return {
                    token: {
                        denom: asset.info.token.contract_addr,
                        amount: asset.amount
                    }
                }
            } else {
                return {
                    token: {
                        denom: asset.info.native_token.denom,
                        amount: asset.amount
                    }
                }
            }
        })

        
    }
}