import * as _12 from './MarsRewardsCollectorOsmosis.types';
import * as _13 from './MarsRewardsCollectorOsmosis.client';
import * as _14 from './MarsRewardsCollectorOsmosis.react-query';
export declare namespace contracts {
    const MarsRewardsCollectorOsmosis: {
        useMarsRewardsCollectorOsmosisRoutesQuery<TData = _12.ArrayOfRouteResponseForString>({ client, args, options, }: _14.MarsRewardsCollectorOsmosisRoutesQuery<TData>): any;
        useMarsRewardsCollectorOsmosisRouteQuery<TData_1 = _12.RouteResponseForString>({ client, args, options, }: _14.MarsRewardsCollectorOsmosisRouteQuery<TData_1>): any;
        useMarsRewardsCollectorOsmosisConfigQuery<TData_2 = _12.ConfigForString>({ client, options, }: _14.MarsRewardsCollectorOsmosisConfigQuery<TData_2>): any;
        useMarsRewardsCollectorOsmosisExecuteCosmosMsgMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _14.MarsRewardsCollectorOsmosisExecuteCosmosMsgMutation>, "mutationFn"> | undefined): any;
        useMarsRewardsCollectorOsmosisSwapAssetMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _14.MarsRewardsCollectorOsmosisSwapAssetMutation>, "mutationFn"> | undefined): any;
        useMarsRewardsCollectorOsmosisDistributeRewardsMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _14.MarsRewardsCollectorOsmosisDistributeRewardsMutation>, "mutationFn"> | undefined): any;
        useMarsRewardsCollectorOsmosisWithdrawFromRedBankMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _14.MarsRewardsCollectorOsmosisWithdrawFromRedBankMutation>, "mutationFn"> | undefined): any;
        useMarsRewardsCollectorOsmosisSetRouteMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _14.MarsRewardsCollectorOsmosisSetRouteMutation>, "mutationFn"> | undefined): any;
        useMarsRewardsCollectorOsmosisUpdateConfigMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _14.MarsRewardsCollectorOsmosisUpdateConfigMutation>, "mutationFn"> | undefined): any;
        marsRewardsCollectorOsmosisQueryKeys: {
            contract: readonly [{
                readonly contract: "marsRewardsCollectorOsmosis";
            }];
            address: (contractAddress: string | undefined) => readonly [{
                readonly address: string | undefined;
                readonly contract: "marsRewardsCollectorOsmosis";
            }];
            config: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "config";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRewardsCollectorOsmosis";
            }];
            route: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "route";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRewardsCollectorOsmosis";
            }];
            routes: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "routes";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRewardsCollectorOsmosis";
            }];
        };
        MarsRewardsCollectorOsmosisQueryClient: typeof _13.MarsRewardsCollectorOsmosisQueryClient;
        MarsRewardsCollectorOsmosisClient: typeof _13.MarsRewardsCollectorOsmosisClient;
    };
}
