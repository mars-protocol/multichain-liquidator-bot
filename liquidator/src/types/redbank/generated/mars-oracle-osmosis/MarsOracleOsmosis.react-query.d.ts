import { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { StdFee, Coin } from '@cosmjs/amino';
import { OsmosisPriceSource, ConfigForString, PriceResponse, PriceSourceResponseForString, ArrayOfPriceSourceResponseForString, ArrayOfPriceResponse } from './MarsOracleOsmosis.types';
import { MarsOracleOsmosisQueryClient, MarsOracleOsmosisClient } from './MarsOracleOsmosis.client';
export declare const marsOracleOsmosisQueryKeys: {
    contract: readonly [{
        readonly contract: "marsOracleOsmosis";
    }];
    address: (contractAddress: string | undefined) => readonly [{
        readonly address: string | undefined;
        readonly contract: "marsOracleOsmosis";
    }];
    config: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "config";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsOracleOsmosis";
    }];
    priceSource: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "price_source";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsOracleOsmosis";
    }];
    priceSources: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "price_sources";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsOracleOsmosis";
    }];
    price: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "price";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsOracleOsmosis";
    }];
    prices: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "prices";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsOracleOsmosis";
    }];
};
export interface MarsOracleOsmosisReactQuery<TResponse, TData = TResponse> {
    client: MarsOracleOsmosisQueryClient | undefined;
    options?: Omit<UseQueryOptions<TResponse, Error, TData>, "'queryKey' | 'queryFn' | 'initialData'"> & {
        initialData?: undefined;
    };
}
export interface MarsOracleOsmosisPricesQuery<TData> extends MarsOracleOsmosisReactQuery<ArrayOfPriceResponse, TData> {
    args: {
        limit?: number;
        startAfter?: string;
    };
}
export declare function useMarsOracleOsmosisPricesQuery<TData = ArrayOfPriceResponse>({ client, args, options, }: MarsOracleOsmosisPricesQuery<TData>): any;
export interface MarsOracleOsmosisPriceQuery<TData> extends MarsOracleOsmosisReactQuery<PriceResponse, TData> {
    args: {
        denom: string;
    };
}
export declare function useMarsOracleOsmosisPriceQuery<TData = PriceResponse>({ client, args, options, }: MarsOracleOsmosisPriceQuery<TData>): any;
export interface MarsOracleOsmosisPriceSourcesQuery<TData> extends MarsOracleOsmosisReactQuery<ArrayOfPriceSourceResponseForString, TData> {
    args: {
        limit?: number;
        startAfter?: string;
    };
}
export declare function useMarsOracleOsmosisPriceSourcesQuery<TData = ArrayOfPriceSourceResponseForString>({ client, args, options, }: MarsOracleOsmosisPriceSourcesQuery<TData>): any;
export interface MarsOracleOsmosisPriceSourceQuery<TData> extends MarsOracleOsmosisReactQuery<PriceSourceResponseForString, TData> {
    args: {
        denom: string;
    };
}
export declare function useMarsOracleOsmosisPriceSourceQuery<TData = PriceSourceResponseForString>({ client, args, options, }: MarsOracleOsmosisPriceSourceQuery<TData>): any;
export interface MarsOracleOsmosisConfigQuery<TData> extends MarsOracleOsmosisReactQuery<ConfigForString, TData> {
}
export declare function useMarsOracleOsmosisConfigQuery<TData = ConfigForString>({ client, options, }: MarsOracleOsmosisConfigQuery<TData>): any;
export interface MarsOracleOsmosisSetPriceSourceMutation {
    client: MarsOracleOsmosisClient;
    msg: {
        denom: string;
        priceSource: OsmosisPriceSource;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsOracleOsmosisSetPriceSourceMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsOracleOsmosisSetPriceSourceMutation>, 'mutationFn'>): any;
export interface MarsOracleOsmosisUpdateConfigMutation {
    client: MarsOracleOsmosisClient;
    msg: {
        owner?: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsOracleOsmosisUpdateConfigMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsOracleOsmosisUpdateConfigMutation>, 'mutationFn'>): any;
