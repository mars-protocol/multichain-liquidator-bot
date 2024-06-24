import { SigningStargateClient } from '@cosmjs/stargate';
import { Seed } from '../../../src/helpers.js';
import { MarsCreditManagerClient } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.client';
import { MarsAccountNftQueryClient } from 'marsjs-types/creditmanager/generated/mars-account-nft/MarsAccountNft.client';
import { Action, Coin } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types';
export declare enum PositionCollectionType {
    CASCADE = 0,
    FIXED = 1
}
export interface RoverHelperConfig {
    seeds: Seed[];
    prefix: string;
    rpcEndpoint: string;
    creditManagerAddress: string;
    accountNft: string;
    redbankAddress: string;
    liquidatorAddress: string;
    oracleAddress: string;
    deployerAddress: string;
    userAddress: string;
    baseDenom: string;
}
export declare const createCreditAccount: (userAddress: string, nft: MarsAccountNftQueryClient, exec: MarsCreditManagerClient) => Promise<string>;
export declare const generateNewAddress: (prefix: string, rpcEndpoint: string) => Promise<{
    client: SigningStargateClient;
    address: string;
}>;
export declare const updateCreditAccount: (actions: Action[], accountId: string, exec: MarsCreditManagerClient, funds?: Coin[]) => Promise<import("@cosmjs/cosmwasm-stargate").ExecuteResult>;
