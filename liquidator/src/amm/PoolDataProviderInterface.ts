import { Pool } from "../types/Pool";

export interface PoolDataProviderInterface {

    loadPools(): Promise<Pool[]>

}