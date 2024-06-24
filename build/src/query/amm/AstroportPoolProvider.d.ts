import { Pool, PoolAsset } from "../../types/Pool";
import { PoolDataProviderInterface } from "./PoolDataProviderInterface";
import { Asset, Pair, PoolQueryResponse, PoolResponseData } from "./types/AstroportTypes";
export declare class AstroportPoolProvider implements PoolDataProviderInterface {
    private astroportFactory;
    private graphqlEndpoint;
    private lcdEndpoint;
    private maxRetries;
    private pairs;
    constructor(astroportFactory: string, graphqlEndpoint: string, lcdEndpoint: string);
    initiate: () => Promise<void>;
    setPairs: (pairs: Pair[]) => void;
    getPairs: () => Pair[];
    objectToBase64(obj: any): string;
    create_pool_query_promise: (query: Promise<PoolResponseData>, contractAddress: string) => Promise<PoolQueryResponse>;
    loadPools: () => Promise<Pool[]>;
    fetchPairContracts(contractAddress: string, limit?: number): Promise<Pair[]>;
    private producePairQuery;
    private findLatestPair;
    private produceStartAfterAsset;
    producePoolAssets: (assets: Asset[]) => PoolAsset[];
}
