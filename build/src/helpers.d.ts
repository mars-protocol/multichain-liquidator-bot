import { CosmWasmClient, MsgExecuteContractEncodeObject, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { AccountData, Coin, DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { MsgSwapExactAmountIn } from 'osmojs/types/codegen/osmosis/poolmanager/v1beta1/tx';
import { MsgSendEncodeObject, SigningStargateClient } from '@cosmjs/stargate';
import { HdPath } from '@cosmjs/crypto';
import { Pool } from './types/Pool';
import { SwapAmountInRoute } from 'osmojs/types/codegen/osmosis/poolmanager/v1beta1/swap_route';
export declare function sleep(timeout: number): Promise<void>;
export declare const camelCaseKeys: (object: Object) => {};
export declare function readAddresses(deployConfigPath: string): ProtocolAddresses;
export declare const getWallet: (mnemonic: string, prefix: string, hdPaths?: HdPath[]) => Promise<DirectSecp256k1HdWallet>;
export declare const getAddress: (wallet: DirectSecp256k1HdWallet) => Promise<string>;
export declare const produceSigningStargateClient: (rpcEndpoint: string, liquidator: DirectSecp256k1HdWallet, gasPrice?: string) => Promise<SigningStargateClient>;
export declare const produceReadOnlyCosmWasmClient: (rpcEndpoint: string) => Promise<CosmWasmClient>;
export declare const produceSigningCosmWasmClient: (rpcEndpoint: string, liquidator: DirectSecp256k1HdWallet, gasPrice?: string) => Promise<SigningCosmWasmClient>;
export declare const findUnderlying: (lpToken: string, pools: Pool[]) => string[] | undefined;
export declare const setPrice: (client: SigningCosmWasmClient, deployerAddress: string, assetDenom: string, price: string, oracleAddress: string) => Promise<void>;
export declare const seedAddresses: (client: SigningCosmWasmClient, sender: string, accounts: readonly AccountData[], coins: Coin[]) => Promise<string[]>;
export declare const withdraw: (client: SigningCosmWasmClient, sender: string, assetDenom: string, amount: string, addresses: ProtocolAddresses) => Promise<import("@cosmjs/cosmwasm-stargate").ExecuteResult>;
export declare const borrow: (client: SigningCosmWasmClient, sender: string, assetDenom: string, amount: string, redbankAddress: string) => Promise<import("@cosmjs/cosmwasm-stargate").ExecuteResult>;
export declare const produceExecuteContractMessage: (sender: string, contract: string, msg: Uint8Array, funds?: Coin[]) => MsgExecuteContractEncodeObject;
export declare const produceSendMessage: (sender: string, recipient: string, funds: Coin[]) => MsgSendEncodeObject;
export declare const produceDepositMessage: (sender: string, redBankContractAddress: string, coins: Coin[]) => MsgExecuteContractEncodeObject;
export declare const produceBorrowMessage: (sender: string, assetDenom: string, amount: string, redBankContractAddress: string) => MsgExecuteContractEncodeObject;
export declare const produceWithdrawMessage: (sender: string, assetDenom: string, redBankContractAddress: string) => MsgExecuteContractEncodeObject;
interface MsgSwapEncodeObject {
    typeUrl: string;
    value: MsgSwapExactAmountIn;
}
export declare const produceRepayMessage: (sender: string, redBankContractAddress: string, coins: Coin[]) => MsgExecuteContractEncodeObject;
export declare const produceSwapMessage: (liquidatorAddress: string, tokenIn: Coin, route: SwapAmountInRoute[]) => MsgSwapEncodeObject;
export declare const deposit: (client: SigningCosmWasmClient, sender: string, assetDenom: string, amount: string, redbankAddress: string) => Promise<import("@cosmjs/cosmwasm-stargate").ExecuteResult>;
export declare const repay: (client: SigningCosmWasmClient, sender: string, assetDenom: string, amount: string, addresses: ProtocolAddresses) => Promise<import("@cosmjs/cosmwasm-stargate").ExecuteResult>;
export declare const queryHealth: (client: CosmWasmClient, address: string, redbankAddress: string) => Promise<any>;
export interface ProtocolAddresses {
    addressProvider: string;
    filterer: string;
    redBank: string;
    incentives: string;
    oracle: string;
    rewardsCollector: string;
}
export declare function readArtifact(name?: string): any;
export interface Seed {
    mnemonic: string;
    address: string;
}
export declare const loadSeeds: () => Seed[];
export {};
