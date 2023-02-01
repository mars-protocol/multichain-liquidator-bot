import * as _3 from './MarsIncentives.types';
import * as _4 from './MarsIncentives.client';
import * as _5 from './MarsIncentives.react-query';
export declare namespace contracts {
    const MarsIncentives: {
        useMarsIncentivesUserUnclaimedRewardsQuery<TData = string>({ client, args, options, }: _5.MarsIncentivesUserUnclaimedRewardsQuery<TData>): any;
        useMarsIncentivesAssetIncentiveQuery<TData_1 = _3.AssetIncentiveResponse>({ client, args, options, }: _5.MarsIncentivesAssetIncentiveQuery<TData_1>): any;
        useMarsIncentivesConfigQuery<TData_2 = _3.Config>({ client, options, }: _5.MarsIncentivesConfigQuery<TData_2>): any;
        useMarsIncentivesExecuteCosmosMsgMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _5.MarsIncentivesExecuteCosmosMsgMutation>, "mutationFn"> | undefined): any;
        useMarsIncentivesUpdateConfigMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _5.MarsIncentivesUpdateConfigMutation>, "mutationFn"> | undefined): any;
        useMarsIncentivesClaimRewardsMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _5.MarsIncentivesClaimRewardsMutation>, "mutationFn"> | undefined): any;
        useMarsIncentivesBalanceChangeMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _5.MarsIncentivesBalanceChangeMutation>, "mutationFn"> | undefined): any;
        useMarsIncentivesSetAssetIncentiveMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _5.MarsIncentivesSetAssetIncentiveMutation>, "mutationFn"> | undefined): any;
        marsIncentivesQueryKeys: {
            contract: readonly [{
                readonly contract: "marsIncentives";
            }];
            address: (contractAddress: string | undefined) => readonly [{
                readonly address: string | undefined;
                readonly contract: "marsIncentives";
            }];
            config: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "config";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsIncentives";
            }];
            assetIncentive: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "asset_incentive";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsIncentives";
            }];
            userUnclaimedRewards: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "user_unclaimed_rewards";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsIncentives";
            }];
        };
        MarsIncentivesQueryClient: typeof _4.MarsIncentivesQueryClient;
        MarsIncentivesClient: typeof _4.MarsIncentivesClient;
    };
}
