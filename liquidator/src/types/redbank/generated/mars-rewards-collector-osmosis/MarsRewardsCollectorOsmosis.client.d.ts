import { CosmWasmClient, SigningCosmWasmClient, ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { StdFee } from '@cosmjs/amino';
import { OsmosisRoute, Uint128, CosmosMsgForEmpty, CreateOrUpdateConfig, Coin, ConfigForString, RouteResponseForString, ArrayOfRouteResponseForString } from './MarsRewardsCollectorOsmosis.types';
export interface MarsRewardsCollectorOsmosisReadOnlyInterface {
    contractAddress: string;
    config: () => Promise<ConfigForString>;
    route: ({ denomIn, denomOut, }: {
        denomIn: string;
        denomOut: string;
    }) => Promise<RouteResponseForString>;
    routes: ({ limit, startAfter, }: {
        limit?: number;
        startAfter?: string[][];
    }) => Promise<ArrayOfRouteResponseForString>;
}
export declare class MarsRewardsCollectorOsmosisQueryClient implements MarsRewardsCollectorOsmosisReadOnlyInterface {
    client: CosmWasmClient;
    contractAddress: string;
    constructor(client: CosmWasmClient, contractAddress: string);
    config: () => Promise<ConfigForString>;
    route: ({ denomIn, denomOut, }: {
        denomIn: string;
        denomOut: string;
    }) => Promise<RouteResponseForString>;
    routes: ({ limit, startAfter, }: {
        limit?: number | undefined;
        startAfter?: string[][] | undefined;
    }) => Promise<ArrayOfRouteResponseForString>;
}
export interface MarsRewardsCollectorOsmosisInterface extends MarsRewardsCollectorOsmosisReadOnlyInterface {
    contractAddress: string;
    sender: string;
    updateConfig: ({ newCfg, }: {
        newCfg: CreateOrUpdateConfig;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    setRoute: ({ denomIn, denomOut, route, }: {
        denomIn: string;
        denomOut: string;
        route: OsmosisRoute;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    withdrawFromRedBank: ({ amount, denom, }: {
        amount?: Uint128;
        denom: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    distributeRewards: ({ amount, denom, }: {
        amount?: Uint128;
        denom: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    swapAsset: ({ amount, denom, }: {
        amount?: Uint128;
        denom: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    executeCosmosMsg: ({ cosmosMsg, }: {
        cosmosMsg: CosmosMsgForEmpty;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
export declare class MarsRewardsCollectorOsmosisClient extends MarsRewardsCollectorOsmosisQueryClient implements MarsRewardsCollectorOsmosisInterface {
    client: SigningCosmWasmClient;
    sender: string;
    contractAddress: string;
    constructor(client: SigningCosmWasmClient, sender: string, contractAddress: string);
    updateConfig: ({ newCfg, }: {
        newCfg: CreateOrUpdateConfig;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    setRoute: ({ denomIn, denomOut, route, }: {
        denomIn: string;
        denomOut: string;
        route: OsmosisRoute;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    withdrawFromRedBank: ({ amount, denom, }: {
        amount?: string | undefined;
        denom: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    distributeRewards: ({ amount, denom, }: {
        amount?: string | undefined;
        denom: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    swapAsset: ({ amount, denom, }: {
        amount?: string | undefined;
        denom: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    executeCosmosMsg: ({ cosmosMsg, }: {
        cosmosMsg: CosmosMsgForEmpty;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
