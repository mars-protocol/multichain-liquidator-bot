export interface InstantiateMsg {
    base_denom: string;
    owner: string;
}
export declare type ExecuteMsg = {
    update_config: {
        owner?: string | null;
    };
} | {
    set_price_source: {
        denom: string;
        price_source: OsmosisPriceSource;
    };
};
export declare type OsmosisPriceSource = {
    fixed: {
        price: Decimal;
        [k: string]: unknown;
    };
} | {
    spot: {
        pool_id: number;
        [k: string]: unknown;
    };
} | {
    twap: {
        pool_id: number;
        window_size: number;
        [k: string]: unknown;
    };
} | {
    liquidity_token: {
        pool_id: number;
        [k: string]: unknown;
    };
};
export declare type Decimal = string;
export declare type QueryMsg = {
    config: {};
} | {
    price_source: {
        denom: string;
    };
} | {
    price_sources: {
        limit?: number | null;
        start_after?: string | null;
    };
} | {
    price: {
        denom: string;
    };
} | {
    prices: {
        limit?: number | null;
        start_after?: string | null;
    };
};
export interface ConfigForString {
    base_denom: string;
    owner: string;
}
export interface PriceResponse {
    denom: string;
    price: Decimal;
}
export interface PriceSourceResponseForString {
    denom: string;
    price_source: string;
}
export declare type ArrayOfPriceSourceResponseForString = PriceSourceResponseForString[];
export declare type ArrayOfPriceResponse = PriceResponse[];
