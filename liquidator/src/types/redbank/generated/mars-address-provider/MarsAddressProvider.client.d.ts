import { CosmWasmClient, SigningCosmWasmClient, ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { Coin, StdFee } from '@cosmjs/amino';
import { InstantiateMsg, MarsContract, AddressResponseItem, ArrayOfAddressResponseItem } from './MarsAddressProvider.types';
export interface MarsAddressProviderReadOnlyInterface {
    contractAddress: string;
    config: () => Promise<InstantiateMsg>;
    address: () => Promise<AddressResponseItem>;
    addresses: () => Promise<ArrayOfAddressResponseItem>;
    allAddresses: ({ limit, startAfter, }: {
        limit?: number;
        startAfter?: MarsContract;
    }) => Promise<ArrayOfAddressResponseItem>;
}
export declare class MarsAddressProviderQueryClient implements MarsAddressProviderReadOnlyInterface {
    client: CosmWasmClient;
    contractAddress: string;
    constructor(client: CosmWasmClient, contractAddress: string);
    config: () => Promise<InstantiateMsg>;
    address: () => Promise<AddressResponseItem>;
    addresses: () => Promise<ArrayOfAddressResponseItem>;
    allAddresses: ({ limit, startAfter, }: {
        limit?: number | undefined;
        startAfter?: MarsContract | undefined;
    }) => Promise<ArrayOfAddressResponseItem>;
}
export interface MarsAddressProviderInterface extends MarsAddressProviderReadOnlyInterface {
    contractAddress: string;
    sender: string;
    setAddress: ({ address, contract, }: {
        address: string;
        contract: MarsContract;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    transferOwnership: ({ newOwner, }: {
        newOwner: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
export declare class MarsAddressProviderClient extends MarsAddressProviderQueryClient implements MarsAddressProviderInterface {
    client: SigningCosmWasmClient;
    sender: string;
    contractAddress: string;
    constructor(client: SigningCosmWasmClient, sender: string, contractAddress: string);
    setAddress: ({ address, contract, }: {
        address: string;
        contract: MarsContract;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    transferOwnership: ({ newOwner, }: {
        newOwner: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
