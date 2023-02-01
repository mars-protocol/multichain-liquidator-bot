import * as _0 from './MarsAddressProvider.types';
import * as _1 from './MarsAddressProvider.client';
import * as _2 from './MarsAddressProvider.react-query';
export declare namespace contracts {
    const MarsAddressProvider: {
        useMarsAddressProviderAllAddressesQuery<TData = _0.ArrayOfAddressResponseItem>({ client, args, options, }: _2.MarsAddressProviderAllAddressesQuery<TData>): any;
        useMarsAddressProviderAddressesQuery<TData_1 = _0.ArrayOfAddressResponseItem>({ client, options, }: _2.MarsAddressProviderAddressesQuery<TData_1>): any;
        useMarsAddressProviderAddressQuery<TData_2 = _0.AddressResponseItem>({ client, options, }: _2.MarsAddressProviderAddressQuery<TData_2>): any;
        useMarsAddressProviderConfigQuery<TData_3 = _0.InstantiateMsg>({ client, options, }: _2.MarsAddressProviderConfigQuery<TData_3>): any;
        useMarsAddressProviderTransferOwnershipMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _2.MarsAddressProviderTransferOwnershipMutation>, "mutationFn"> | undefined): any;
        useMarsAddressProviderSetAddressMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _2.MarsAddressProviderSetAddressMutation>, "mutationFn"> | undefined): any;
        marsAddressProviderQueryKeys: {
            contract: readonly [{
                readonly contract: "marsAddressProvider";
            }];
            address: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => any;
            config: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [any];
            addresses: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [any];
            allAddresses: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [any];
        };
        MarsAddressProviderQueryClient: typeof _1.MarsAddressProviderQueryClient;
        MarsAddressProviderClient: typeof _1.MarsAddressProviderClient;
    };
}
