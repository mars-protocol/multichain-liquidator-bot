import { CosmWasmClient, SigningCosmWasmClient, ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { Coin, StdFee } from '@cosmjs/amino';
import { OsmosisPriceSource, ConfigForString, PriceResponse, PriceSourceResponseForString, ArrayOfPriceSourceResponseForString, ArrayOfPriceResponse } from './MarsOracleOsmosis.types';
export interface MarsOracleOsmosisReadOnlyInterface {
    contractAddress: string;
    config: () => Promise<ConfigForString>;
    priceSource: ({ denom }: {
        denom: string;
    }) => Promise<PriceSourceResponseForString>;
    priceSources: ({ limit, startAfter, }: {
        limit?: number;
        startAfter?: string;
    }) => Promise<ArrayOfPriceSourceResponseForString>;
    price: ({ denom }: {
        denom: string;
    }) => Promise<PriceResponse>;
    prices: ({ limit, startAfter, }: {
        limit?: number;
        startAfter?: string;
    }) => Promise<ArrayOfPriceResponse>;
}
export declare class MarsOracleOsmosisQueryClient implements MarsOracleOsmosisReadOnlyInterface {
    client: CosmWasmClient;
    contractAddress: string;
    constructor(client: CosmWasmClient, contractAddress: string);
    config: () => Promise<ConfigForString>;
    priceSource: ({ denom }: {
        denom: string;
    }) => Promise<PriceSourceResponseForString>;
    priceSources: ({ limit, startAfter, }: {
        limit?: number | undefined;
        startAfter?: string | undefined;
    }) => Promise<ArrayOfPriceSourceResponseForString>;
    price: ({ denom }: {
        denom: string;
    }) => Promise<PriceResponse>;
    prices: ({ limit, startAfter, }: {
        limit?: number | undefined;
        startAfter?: string | undefined;
    }) => Promise<ArrayOfPriceResponse>;
}
export interface MarsOracleOsmosisInterface extends MarsOracleOsmosisReadOnlyInterface {
    contractAddress: string;
    sender: string;
    updateConfig: ({ owner, }: {
        owner?: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    setPriceSource: ({ denom, priceSource, }: {
        denom: string;
        priceSource: OsmosisPriceSource;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
export declare class MarsOracleOsmosisClient extends MarsOracleOsmosisQueryClient implements MarsOracleOsmosisInterface {
    client: SigningCosmWasmClient;
    sender: string;
    contractAddress: string;
    constructor(client: SigningCosmWasmClient, sender: string, contractAddress: string);
    updateConfig: ({ owner, }: {
        owner?: string | undefined;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    setPriceSource: ({ denom, priceSource, }: {
        denom: string;
        priceSource: OsmosisPriceSource;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
