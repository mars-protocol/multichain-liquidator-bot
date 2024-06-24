import { sleep } from "../../helpers";
import { Pool, PoolAsset, PoolType, XYKPool } from "../../types/Pool";
import { PoolDataProviderInterface } from "./PoolDataProviderInterface";
import fetch from 'cross-fetch'
import { Asset, AssetInfoCW, AssetInfoNative, ContractQueryPairs, Pair, PoolQueryResponse, PoolResponseData, Query, ResponseData } from "./types/AstroportTypes";
import { queryWasmLcd } from "../utils";

export class AstroportPoolProvider implements PoolDataProviderInterface {
    
    private maxRetries = 8

    private pairs : Pair[] = []
    
    constructor(
        private astroportFactory: string,
        private graphqlEndpoint : string,
        private lcdEndpoint: string
    ) {}
    
    initiate = async () => {
        this.pairs = await this.fetchPairContracts(this.astroportFactory)

        // refresh pool contracts every 30 minutes
        setInterval(() => {this.fetchPairContracts(this.astroportFactory)}, 1000 * 60 * 30)
    }

    setPairs = (pairs: Pair[]) => {
        this.pairs = pairs
    }

    getPairs = () : Pair[] => {
        return this.pairs
    }
    objectToBase64(obj: any): string {
        const jsonString = JSON.stringify(obj);
        const base64String = Buffer.from(jsonString).toString('base64');
        return base64String;
    }

    create_pool_query_promise = async(
        query: Promise<PoolResponseData>,
        contractAddress: string) : Promise<PoolQueryResponse> => {
        return {
            contractAddress,
            result: await query
        }
    }

    loadPools = async ():Promise<Pool[]>  => {

        if (this.pairs.length === 0) {
            throw new Error("Pools still not loaded. Ensure you have called initiate()")
        }

        // We want to know the owner of our pool queries, as it is not on the response
        // Therefore, we create an object to keep the address of the pool with the query
        const poolQueryPromises = this.pairs.map(
            (pair) => this.create_pool_query_promise(
                queryWasmLcd<PoolResponseData>(
                this.lcdEndpoint,
                pair.contract_addr,
                this.objectToBase64(
                    {
                        pool: {}
                    }
                )),
                pair.contract_addr
        ))

        let poolResponses = await Promise.all(poolQueryPromises)

        return poolResponses
            .filter((poolResponse) => poolResponse.result.data)
            .map((poolResponse, index) => {
                    
                const poolAssets = this.producePoolAssets(poolResponse.result.data.assets)
                // TODO update to support PCL
                const pool : XYKPool = {
                    address : poolResponse.contractAddress,
                    id : index as unknown as Long,
                    poolAssets : poolAssets,
                    swapFee : "0.003",
                    token0 : poolAssets[0].token.denom,
                    token1: poolAssets[1].token.denom,
                    poolType : PoolType.XYK
                }
    
                return pool
            })
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

    private produceStartAfterAsset = (asset : AssetInfoCW | AssetInfoNative) => { 
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
