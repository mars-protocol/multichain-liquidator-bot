import { CosmWasmClient, SigningCosmWasmClient, ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { Coin, StdFee } from '@cosmjs/amino';
import { CreateOrUpdateConfig, Uint128, InitOrUpdateAssetParams, ConfigForString, Market, ArrayOfMarket, UncollateralizedLoanLimitResponse, ArrayOfUncollateralizedLoanLimitResponse, UserCollateralResponse, ArrayOfUserCollateralResponse, UserDebtResponse, ArrayOfUserDebtResponse, UserPositionResponse } from './MarsRedBank.types';
export interface MarsRedBankReadOnlyInterface {
    contractAddress: string;
    config: () => Promise<ConfigForString>;
    market: ({ denom }: {
        denom: string;
    }) => Promise<Market>;
    markets: ({ limit, startAfter, }: {
        limit?: number;
        startAfter?: string;
    }) => Promise<ArrayOfMarket>;
    uncollateralizedLoanLimit: ({ denom, user, }: {
        denom: string;
        user: string;
    }) => Promise<UncollateralizedLoanLimitResponse>;
    uncollateralizedLoanLimits: ({ limit, startAfter, user, }: {
        limit?: number;
        startAfter?: string;
        user: string;
    }) => Promise<ArrayOfUncollateralizedLoanLimitResponse>;
    userDebt: ({ denom, user }: {
        denom: string;
        user: string;
    }) => Promise<UserDebtResponse>;
    userDebts: ({ limit, startAfter, user, }: {
        limit?: number;
        startAfter?: string;
        user: string;
    }) => Promise<ArrayOfUserDebtResponse>;
    userCollateral: ({ denom, user, }: {
        denom: string;
        user: string;
    }) => Promise<UserCollateralResponse>;
    userCollaterals: ({ limit, startAfter, user, }: {
        limit?: number;
        startAfter?: string;
        user: string;
    }) => Promise<ArrayOfUserCollateralResponse>;
    userPosition: ({ user }: {
        user: string;
    }) => Promise<UserPositionResponse>;
    scaledLiquidityAmount: ({ amount, denom }: {
        amount: Uint128;
        denom: string;
    }) => Promise<Uint128>;
    scaledDebtAmount: ({ amount, denom }: {
        amount: Uint128;
        denom: string;
    }) => Promise<Uint128>;
    underlyingLiquidityAmount: ({ amountScaled, denom, }: {
        amountScaled: Uint128;
        denom: string;
    }) => Promise<Uint128>;
    underlyingDebtAmount: ({ amountScaled, denom, }: {
        amountScaled: Uint128;
        denom: string;
    }) => Promise<Uint128>;
}
export declare class MarsRedBankQueryClient implements MarsRedBankReadOnlyInterface {
    client: CosmWasmClient;
    contractAddress: string;
    constructor(client: CosmWasmClient, contractAddress: string);
    config: () => Promise<ConfigForString>;
    market: ({ denom }: {
        denom: string;
    }) => Promise<Market>;
    markets: ({ limit, startAfter, }: {
        limit?: number | undefined;
        startAfter?: string | undefined;
    }) => Promise<ArrayOfMarket>;
    uncollateralizedLoanLimit: ({ denom, user, }: {
        denom: string;
        user: string;
    }) => Promise<UncollateralizedLoanLimitResponse>;
    uncollateralizedLoanLimits: ({ limit, startAfter, user, }: {
        limit?: number | undefined;
        startAfter?: string | undefined;
        user: string;
    }) => Promise<ArrayOfUncollateralizedLoanLimitResponse>;
    userDebt: ({ denom, user, }: {
        denom: string;
        user: string;
    }) => Promise<UserDebtResponse>;
    userDebts: ({ limit, startAfter, user, }: {
        limit?: number | undefined;
        startAfter?: string | undefined;
        user: string;
    }) => Promise<ArrayOfUserDebtResponse>;
    userCollateral: ({ denom, user, }: {
        denom: string;
        user: string;
    }) => Promise<UserCollateralResponse>;
    userCollaterals: ({ limit, startAfter, user, }: {
        limit?: number | undefined;
        startAfter?: string | undefined;
        user: string;
    }) => Promise<ArrayOfUserCollateralResponse>;
    userPosition: ({ user }: {
        user: string;
    }) => Promise<UserPositionResponse>;
    scaledLiquidityAmount: ({ amount, denom, }: {
        amount: Uint128;
        denom: string;
    }) => Promise<Uint128>;
    scaledDebtAmount: ({ amount, denom, }: {
        amount: Uint128;
        denom: string;
    }) => Promise<Uint128>;
    underlyingLiquidityAmount: ({ amountScaled, denom, }: {
        amountScaled: Uint128;
        denom: string;
    }) => Promise<Uint128>;
    underlyingDebtAmount: ({ amountScaled, denom, }: {
        amountScaled: Uint128;
        denom: string;
    }) => Promise<Uint128>;
}
export interface MarsRedBankInterface extends MarsRedBankReadOnlyInterface {
    contractAddress: string;
    sender: string;
    updateConfig: ({ config, }: {
        config: CreateOrUpdateConfig;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    initAsset: ({ denom, params, }: {
        denom: string;
        params: InitOrUpdateAssetParams;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    updateAsset: ({ denom, params, }: {
        denom: string;
        params: InitOrUpdateAssetParams;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    updateUncollateralizedLoanLimit: ({ denom, newLimit, user, }: {
        denom: string;
        newLimit: Uint128;
        user: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    deposit: ({ onBehalfOf, }: {
        onBehalfOf?: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    withdraw: ({ amount, denom, recipient, }: {
        amount?: Uint128;
        denom: string;
        recipient?: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    borrow: ({ amount, denom, recipient, }: {
        amount: Uint128;
        denom: string;
        recipient?: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    repay: ({ onBehalfOf, }: {
        onBehalfOf?: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    liquidate: ({ collateralDenom, user, }: {
        collateralDenom: string;
        user: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    updateAssetCollateralStatus: ({ denom, enable, }: {
        denom: string;
        enable: boolean;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
export declare class MarsRedBankClient extends MarsRedBankQueryClient implements MarsRedBankInterface {
    client: SigningCosmWasmClient;
    sender: string;
    contractAddress: string;
    constructor(client: SigningCosmWasmClient, sender: string, contractAddress: string);
    updateConfig: ({ config, }: {
        config: CreateOrUpdateConfig;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    initAsset: ({ denom, params, }: {
        denom: string;
        params: InitOrUpdateAssetParams;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    updateAsset: ({ denom, params, }: {
        denom: string;
        params: InitOrUpdateAssetParams;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    updateUncollateralizedLoanLimit: ({ denom, newLimit, user, }: {
        denom: string;
        newLimit: Uint128;
        user: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    deposit: ({ onBehalfOf, }: {
        onBehalfOf?: string | undefined;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    withdraw: ({ amount, denom, recipient, }: {
        amount?: string | undefined;
        denom: string;
        recipient?: string | undefined;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    borrow: ({ amount, denom, recipient, }: {
        amount: Uint128;
        denom: string;
        recipient?: string | undefined;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    repay: ({ onBehalfOf, }: {
        onBehalfOf?: string | undefined;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    liquidate: ({ collateralDenom, user, }: {
        collateralDenom: string;
        user: string;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
    updateAssetCollateralStatus: ({ denom, enable, }: {
        denom: string;
        enable: boolean;
    }, fee?: number | StdFee | 'auto', memo?: string, funds?: Coin[]) => Promise<ExecuteResult>;
}
