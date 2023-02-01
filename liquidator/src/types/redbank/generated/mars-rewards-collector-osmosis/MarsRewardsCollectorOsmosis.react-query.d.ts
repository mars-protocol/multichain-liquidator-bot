import { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { StdFee } from '@cosmjs/amino';
import { OsmosisRoute, Uint128, CosmosMsgForEmpty, CreateOrUpdateConfig, Coin, ConfigForString, RouteResponseForString, ArrayOfRouteResponseForString } from './MarsRewardsCollectorOsmosis.types';
import { MarsRewardsCollectorOsmosisQueryClient, MarsRewardsCollectorOsmosisClient } from './MarsRewardsCollectorOsmosis.client';
export declare const marsRewardsCollectorOsmosisQueryKeys: {
    contract: readonly [{
        readonly contract: "marsRewardsCollectorOsmosis";
    }];
    address: (contractAddress: string | undefined) => readonly [{
        readonly address: string | undefined;
        readonly contract: "marsRewardsCollectorOsmosis";
    }];
    config: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "config";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRewardsCollectorOsmosis";
    }];
    route: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "route";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRewardsCollectorOsmosis";
    }];
    routes: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "routes";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRewardsCollectorOsmosis";
    }];
};
export interface MarsRewardsCollectorOsmosisReactQuery<TResponse, TData = TResponse> {
    client: MarsRewardsCollectorOsmosisQueryClient | undefined;
    options?: Omit<UseQueryOptions<TResponse, Error, TData>, "'queryKey' | 'queryFn' | 'initialData'"> & {
        initialData?: undefined;
    };
}
export interface MarsRewardsCollectorOsmosisRoutesQuery<TData> extends MarsRewardsCollectorOsmosisReactQuery<ArrayOfRouteResponseForString, TData> {
    args: {
        limit?: number;
        startAfter?: string[][];
    };
}
export declare function useMarsRewardsCollectorOsmosisRoutesQuery<TData = ArrayOfRouteResponseForString>({ client, args, options, }: MarsRewardsCollectorOsmosisRoutesQuery<TData>): any;
export interface MarsRewardsCollectorOsmosisRouteQuery<TData> extends MarsRewardsCollectorOsmosisReactQuery<RouteResponseForString, TData> {
    args: {
        denomIn: string;
        denomOut: string;
    };
}
export declare function useMarsRewardsCollectorOsmosisRouteQuery<TData = RouteResponseForString>({ client, args, options, }: MarsRewardsCollectorOsmosisRouteQuery<TData>): any;
export interface MarsRewardsCollectorOsmosisConfigQuery<TData> extends MarsRewardsCollectorOsmosisReactQuery<ConfigForString, TData> {
}
export declare function useMarsRewardsCollectorOsmosisConfigQuery<TData = ConfigForString>({ client, options, }: MarsRewardsCollectorOsmosisConfigQuery<TData>): any;
export interface MarsRewardsCollectorOsmosisExecuteCosmosMsgMutation {
    client: MarsRewardsCollectorOsmosisClient;
    msg: {
        cosmosMsg: CosmosMsgForEmpty;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRewardsCollectorOsmosisExecuteCosmosMsgMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRewardsCollectorOsmosisExecuteCosmosMsgMutation>, 'mutationFn'>): any;
export interface MarsRewardsCollectorOsmosisSwapAssetMutation {
    client: MarsRewardsCollectorOsmosisClient;
    msg: {
        amount?: Uint128;
        denom: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRewardsCollectorOsmosisSwapAssetMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRewardsCollectorOsmosisSwapAssetMutation>, 'mutationFn'>): any;
export interface MarsRewardsCollectorOsmosisDistributeRewardsMutation {
    client: MarsRewardsCollectorOsmosisClient;
    msg: {
        amount?: Uint128;
        denom: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRewardsCollectorOsmosisDistributeRewardsMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRewardsCollectorOsmosisDistributeRewardsMutation>, 'mutationFn'>): any;
export interface MarsRewardsCollectorOsmosisWithdrawFromRedBankMutation {
    client: MarsRewardsCollectorOsmosisClient;
    msg: {
        amount?: Uint128;
        denom: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRewardsCollectorOsmosisWithdrawFromRedBankMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRewardsCollectorOsmosisWithdrawFromRedBankMutation>, 'mutationFn'>): any;
export interface MarsRewardsCollectorOsmosisSetRouteMutation {
    client: MarsRewardsCollectorOsmosisClient;
    msg: {
        denomIn: string;
        denomOut: string;
        route: OsmosisRoute;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRewardsCollectorOsmosisSetRouteMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRewardsCollectorOsmosisSetRouteMutation>, 'mutationFn'>): any;
export interface MarsRewardsCollectorOsmosisUpdateConfigMutation {
    client: MarsRewardsCollectorOsmosisClient;
    msg: {
        newCfg: CreateOrUpdateConfig;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRewardsCollectorOsmosisUpdateConfigMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRewardsCollectorOsmosisUpdateConfigMutation>, 'mutationFn'>): any;
