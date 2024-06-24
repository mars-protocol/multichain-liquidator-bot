import { OraclePrice, PriceFetcher } from "./PriceFetcherInterface";
export interface PythPriceFetcherParams {
    priceFeedId: string;
    denomDecimals: number;
    denom: string;
}
export declare class PythPriceFetcher implements PriceFetcher {
    fetchPrice(params: PythPriceFetcherParams): Promise<OraclePrice>;
}
