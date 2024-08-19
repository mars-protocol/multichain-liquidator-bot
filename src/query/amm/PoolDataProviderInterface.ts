import { Pool } from "../../types/Pool";

export interface PoolDataProvider {

    loadPools(): Promise<Pool[]>

}