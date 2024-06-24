import { Pool } from "../../types/Pool";
import { PoolDataProviderInterface } from "./PoolDataProviderInterface";
export declare class OsmosisPoolProvider implements PoolDataProviderInterface {
    private lcdEndpoint;
    constructor(lcdEndpoint: string);
    loadPools: () => Promise<Pool[]>;
    private fetchTickData;
    private fetchDepths;
    private sendRequest;
}
