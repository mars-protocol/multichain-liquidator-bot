import { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { StdFee, Coin } from '@cosmjs/amino';
import { InstantiateMsg, MarsContract, AddressResponseItem, ArrayOfAddressResponseItem } from './MarsAddressProvider.types';
import { MarsAddressProviderQueryClient, MarsAddressProviderClient } from './MarsAddressProvider.client';
export declare const marsAddressProviderQueryKeys: {
    contract: readonly [{
        readonly contract: "marsAddressProvider";
    }];
    address: (contractAddress: string | undefined, args?: Record<string, unknown>) => any;
    config: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [any];
    addresses: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [any];
    allAddresses: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [any];
};
export interface MarsAddressProviderReactQuery<TResponse, TData = TResponse> {
    client: MarsAddressProviderQueryClient | undefined;
    options?: Omit<UseQueryOptions<TResponse, Error, TData>, "'queryKey' | 'queryFn' | 'initialData'"> & {
        initialData?: undefined;
    };
}
export interface MarsAddressProviderAllAddressesQuery<TData> extends MarsAddressProviderReactQuery<ArrayOfAddressResponseItem, TData> {
    args: {
        limit?: number;
        startAfter?: MarsContract;
    };
}
export declare function useMarsAddressProviderAllAddressesQuery<TData = ArrayOfAddressResponseItem>({ client, args, options, }: MarsAddressProviderAllAddressesQuery<TData>): any;
export interface MarsAddressProviderAddressesQuery<TData> extends MarsAddressProviderReactQuery<ArrayOfAddressResponseItem, TData> {
}
export declare function useMarsAddressProviderAddressesQuery<TData = ArrayOfAddressResponseItem>({ client, options, }: MarsAddressProviderAddressesQuery<TData>): any;
export interface MarsAddressProviderAddressQuery<TData> extends MarsAddressProviderReactQuery<AddressResponseItem, TData> {
}
export declare function useMarsAddressProviderAddressQuery<TData = AddressResponseItem>({ client, options, }: MarsAddressProviderAddressQuery<TData>): any;
export interface MarsAddressProviderConfigQuery<TData> extends MarsAddressProviderReactQuery<InstantiateMsg, TData> {
}
export declare function useMarsAddressProviderConfigQuery<TData = InstantiateMsg>({ client, options, }: MarsAddressProviderConfigQuery<TData>): any;
export interface MarsAddressProviderTransferOwnershipMutation {
    client: MarsAddressProviderClient;
    msg: {
        newOwner: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsAddressProviderTransferOwnershipMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsAddressProviderTransferOwnershipMutation>, 'mutationFn'>): any;
export interface MarsAddressProviderSetAddressMutation {
    client: MarsAddressProviderClient;
    msg: {
        address: string;
        contract: MarsContract;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsAddressProviderSetAddressMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsAddressProviderSetAddressMutation>, 'mutationFn'>): any;
