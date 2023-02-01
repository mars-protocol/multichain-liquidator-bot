import { CosmWasmClient, SigningCosmWasmClient, ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { StdFee } from '@cosmjs/amino';
import { Uint128, Addr, Coin, AssetIncentiveResponse, Config } from './MarsIncentives.types';
export interface MarsIncentivesReadOnlyInterface {
    contractAddress: string;
    config: () => Promise<Config>;
    assetIncentive: ({ denom }: {
        denom: string;
    }) => Promise<AssetIncentiveResponse>;
    userUnclaimedRewards: ({ user }: {
        user: string;
    }) => Promise<Uint128>;
}
export declare class MarsIncentivesQueryClient implements MarsIncentivesReadOnlyInterface {
    client: CosmWasmClient;
    contractAddress: string;
    constructor(client: CosmWasmClient, contractAddress: string);
    config: () => Promise<Config>;
    assetIncentive: ({ denom }: {
        denom: string;
    }) => Promise<AssetIncentiveResponse>;
    userUnclaimedRewards: ({ user }: {
        user: string;
    }) => Promise<Uint128>;
}
export interface MarsIncentivesInterface extends MarsIncentivesReadOnlyInterface {
    contractAddress: string;
    sender: string;
    setAssetIncentive: ({ denom, emissionPerSecond, }: {
        denom: string;
        emissionPerSecond: Uint128;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    balanceChange: ({ denom, totalAmountScaledBefore, userAddr, userAmountScaledBefore, }: {
        denom: string;
        totalAmountScaledBefore: Uint128;
        userAddr: Addr;
        userAmountScaledBefore: Uint128;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    claimRewards: (fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    updateConfig: ({ addressProvider, marsDenom, owner, }: {
        addressProvider?: string;
        marsDenom?: string;
        owner?: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    executeCosmosMsg: (fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
export declare class MarsIncentivesClient extends MarsIncentivesQueryClient implements MarsIncentivesInterface {
    client: SigningCosmWasmClient;
    sender: string;
    contractAddress: string;
    constructor(client: SigningCosmWasmClient, sender: string, contractAddress: string);
    setAssetIncentive: ({ denom, emissionPerSecond, }: {
        denom: string;
        emissionPerSecond: Uint128;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    balanceChange: ({ denom, totalAmountScaledBefore, userAddr, userAmountScaledBefore, }: {
        denom: string;
        totalAmountScaledBefore: Uint128;
        userAddr: Addr;
        userAmountScaledBefore: Uint128;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    claimRewards: (fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    updateConfig: ({ addressProvider, marsDenom, owner, }: {
        addressProvider?: string | undefined;
        marsDenom?: string | undefined;
        owner?: string | undefined;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    executeCosmosMsg: (fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
