import BigNumber from "bignumber.js";

export interface PriceFetcher {
    fetchPrice(params: {}): Promise<OraclePrice>
}

export interface OraclePrice {
    price: BigNumber,
    denom: string
}
