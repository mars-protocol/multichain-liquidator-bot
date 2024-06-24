import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { OraclePrice, PriceFetcher } from "./PriceFetcherInterface";
export interface OsmosisOraclePriceFetcherParams {
    oracleAddress: string;
    priceDenom: string;
}
export declare class OsmosisOraclePriceFetcher implements PriceFetcher {
    private client;
    constructor(client: CosmWasmClient);
    fetchPrice(params: OsmosisOraclePriceFetcherParams): Promise<OraclePrice>;
}
