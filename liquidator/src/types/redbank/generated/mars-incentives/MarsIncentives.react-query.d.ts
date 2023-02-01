import { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { StdFee } from '@cosmjs/amino';
import { Uint128, Addr, CosmosMsgForEmpty, Coin, AssetIncentiveResponse, Config } from './MarsIncentives.types';
import { MarsIncentivesQueryClient, MarsIncentivesClient } from './MarsIncentives.client';
export declare const marsIncentivesQueryKeys: {
    contract: readonly [{
        readonly contract: "marsIncentives";
    }];
    address: (contractAddress: string | undefined) => readonly [{
        readonly address: string | undefined;
        readonly contract: "marsIncentives";
    }];
    config: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "config";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsIncentives";
    }];
    assetIncentive: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "asset_incentive";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsIncentives";
    }];
    userUnclaimedRewards: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "user_unclaimed_rewards";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsIncentives";
    }];
};
export interface MarsIncentivesReactQuery<TResponse, TData = TResponse> {
    client: MarsIncentivesQueryClient | undefined;
    options?: Omit<UseQueryOptions<TResponse, Error, TData>, "'queryKey' | 'queryFn' | 'initialData'"> & {
        initialData?: undefined;
    };
}
export interface MarsIncentivesUserUnclaimedRewardsQuery<TData> extends MarsIncentivesReactQuery<Uint128, TData> {
    args: {
        user: string;
    };
}
export declare function useMarsIncentivesUserUnclaimedRewardsQuery<TData = Uint128>({ client, args, options, }: MarsIncentivesUserUnclaimedRewardsQuery<TData>): any;
export interface MarsIncentivesAssetIncentiveQuery<TData> extends MarsIncentivesReactQuery<AssetIncentiveResponse, TData> {
    args: {
        denom: string;
    };
}
export declare function useMarsIncentivesAssetIncentiveQuery<TData = AssetIncentiveResponse>({ client, args, options, }: MarsIncentivesAssetIncentiveQuery<TData>): any;
export interface MarsIncentivesConfigQuery<TData> extends MarsIncentivesReactQuery<Config, TData> {
}
export declare function useMarsIncentivesConfigQuery<TData = Config>({ client, options, }: MarsIncentivesConfigQuery<TData>): any;
export interface MarsIncentivesExecuteCosmosMsgMutation {
    client: MarsIncentivesClient;
    msg: CosmosMsgForEmpty;
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsIncentivesExecuteCosmosMsgMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsIncentivesExecuteCosmosMsgMutation>, 'mutationFn'>): any;
export interface MarsIncentivesUpdateConfigMutation {
    client: MarsIncentivesClient;
    msg: {
        addressProvider?: string;
        marsDenom?: string;
        owner?: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsIncentivesUpdateConfigMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsIncentivesUpdateConfigMutation>, 'mutationFn'>): any;
export interface MarsIncentivesClaimRewardsMutation {
    client: MarsIncentivesClient;
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsIncentivesClaimRewardsMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsIncentivesClaimRewardsMutation>, 'mutationFn'>): any;
export interface MarsIncentivesBalanceChangeMutation {
    client: MarsIncentivesClient;
    msg: {
        denom: string;
        totalAmountScaledBefore: Uint128;
        userAddr: Addr;
        userAmountScaledBefore: Uint128;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsIncentivesBalanceChangeMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsIncentivesBalanceChangeMutation>, 'mutationFn'>): any;
export interface MarsIncentivesSetAssetIncentiveMutation {
    client: MarsIncentivesClient;
    msg: {
        denom: string;
        emissionPerSecond: Uint128;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsIncentivesSetAssetIncentiveMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsIncentivesSetAssetIncentiveMutation>, 'mutationFn'>): any;
