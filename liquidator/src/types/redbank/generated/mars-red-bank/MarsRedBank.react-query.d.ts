import { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { StdFee, Coin } from '@cosmjs/amino';
import { CreateOrUpdateConfig, Uint128, InitOrUpdateAssetParams, ConfigForString, Market, ArrayOfMarket, UncollateralizedLoanLimitResponse, ArrayOfUncollateralizedLoanLimitResponse, UserCollateralResponse, ArrayOfUserCollateralResponse, UserDebtResponse, ArrayOfUserDebtResponse, UserPositionResponse } from './MarsRedBank.types';
import { MarsRedBankQueryClient, MarsRedBankClient } from './MarsRedBank.client';
export declare const marsRedBankQueryKeys: {
    contract: readonly [{
        readonly contract: "marsRedBank";
    }];
    address: (contractAddress: string | undefined) => readonly [{
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    config: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "config";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    market: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "market";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    markets: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "markets";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    uncollateralizedLoanLimit: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "uncollateralized_loan_limit";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    uncollateralizedLoanLimits: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "uncollateralized_loan_limits";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    userDebt: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "user_debt";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    userDebts: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "user_debts";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    userCollateral: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "user_collateral";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    userCollaterals: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "user_collaterals";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    userPosition: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "user_position";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    scaledLiquidityAmount: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "scaled_liquidity_amount";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    scaledDebtAmount: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "scaled_debt_amount";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    underlyingLiquidityAmount: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "underlying_liquidity_amount";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
    underlyingDebtAmount: (contractAddress: string | undefined, args?: Record<string, unknown>) => readonly [{
        readonly method: "underlying_debt_amount";
        readonly args: Record<string, unknown> | undefined;
        readonly address: string | undefined;
        readonly contract: "marsRedBank";
    }];
};
export interface MarsRedBankReactQuery<TResponse, TData = TResponse> {
    client: MarsRedBankQueryClient | undefined;
    options?: Omit<UseQueryOptions<TResponse, Error, TData>, "'queryKey' | 'queryFn' | 'initialData'"> & {
        initialData?: undefined;
    };
}
export interface MarsRedBankUnderlyingDebtAmountQuery<TData> extends MarsRedBankReactQuery<Uint128, TData> {
    args: {
        amountScaled: Uint128;
        denom: string;
    };
}
export declare function useMarsRedBankUnderlyingDebtAmountQuery<TData = Uint128>({ client, args, options, }: MarsRedBankUnderlyingDebtAmountQuery<TData>): any;
export interface MarsRedBankUnderlyingLiquidityAmountQuery<TData> extends MarsRedBankReactQuery<Uint128, TData> {
    args: {
        amountScaled: Uint128;
        denom: string;
    };
}
export declare function useMarsRedBankUnderlyingLiquidityAmountQuery<TData = Uint128>({ client, args, options, }: MarsRedBankUnderlyingLiquidityAmountQuery<TData>): any;
export interface MarsRedBankScaledDebtAmountQuery<TData> extends MarsRedBankReactQuery<Uint128, TData> {
    args: {
        amount: Uint128;
        denom: string;
    };
}
export declare function useMarsRedBankScaledDebtAmountQuery<TData = Uint128>({ client, args, options, }: MarsRedBankScaledDebtAmountQuery<TData>): any;
export interface MarsRedBankScaledLiquidityAmountQuery<TData> extends MarsRedBankReactQuery<Uint128, TData> {
    args: {
        amount: Uint128;
        denom: string;
    };
}
export declare function useMarsRedBankScaledLiquidityAmountQuery<TData = Uint128>({ client, args, options, }: MarsRedBankScaledLiquidityAmountQuery<TData>): any;
export interface MarsRedBankUserPositionQuery<TData> extends MarsRedBankReactQuery<UserPositionResponse, TData> {
    args: {
        user: string;
    };
}
export declare function useMarsRedBankUserPositionQuery<TData = UserPositionResponse>({ client, args, options, }: MarsRedBankUserPositionQuery<TData>): any;
export interface MarsRedBankUserCollateralsQuery<TData> extends MarsRedBankReactQuery<ArrayOfUserCollateralResponse, TData> {
    args: {
        limit?: number;
        startAfter?: string;
        user: string;
    };
}
export declare function useMarsRedBankUserCollateralsQuery<TData = ArrayOfUserCollateralResponse>({ client, args, options, }: MarsRedBankUserCollateralsQuery<TData>): any;
export interface MarsRedBankUserCollateralQuery<TData> extends MarsRedBankReactQuery<UserCollateralResponse, TData> {
    args: {
        denom: string;
        user: string;
    };
}
export declare function useMarsRedBankUserCollateralQuery<TData = UserCollateralResponse>({ client, args, options, }: MarsRedBankUserCollateralQuery<TData>): any;
export interface MarsRedBankUserDebtsQuery<TData> extends MarsRedBankReactQuery<ArrayOfUserDebtResponse, TData> {
    args: {
        limit?: number;
        startAfter?: string;
        user: string;
    };
}
export declare function useMarsRedBankUserDebtsQuery<TData = ArrayOfUserDebtResponse>({ client, args, options, }: MarsRedBankUserDebtsQuery<TData>): any;
export interface MarsRedBankUserDebtQuery<TData> extends MarsRedBankReactQuery<UserDebtResponse, TData> {
    args: {
        denom: string;
        user: string;
    };
}
export declare function useMarsRedBankUserDebtQuery<TData = UserDebtResponse>({ client, args, options, }: MarsRedBankUserDebtQuery<TData>): any;
export interface MarsRedBankUncollateralizedLoanLimitsQuery<TData> extends MarsRedBankReactQuery<ArrayOfUncollateralizedLoanLimitResponse, TData> {
    args: {
        limit?: number;
        startAfter?: string;
        user: string;
    };
}
export declare function useMarsRedBankUncollateralizedLoanLimitsQuery<TData = ArrayOfUncollateralizedLoanLimitResponse>({ client, args, options }: MarsRedBankUncollateralizedLoanLimitsQuery<TData>): any;
export interface MarsRedBankUncollateralizedLoanLimitQuery<TData> extends MarsRedBankReactQuery<UncollateralizedLoanLimitResponse, TData> {
    args: {
        denom: string;
        user: string;
    };
}
export declare function useMarsRedBankUncollateralizedLoanLimitQuery<TData = UncollateralizedLoanLimitResponse>({ client, args, options }: MarsRedBankUncollateralizedLoanLimitQuery<TData>): any;
export interface MarsRedBankMarketsQuery<TData> extends MarsRedBankReactQuery<ArrayOfMarket, TData> {
    args: {
        limit?: number;
        startAfter?: string;
    };
}
export declare function useMarsRedBankMarketsQuery<TData = ArrayOfMarket>({ client, args, options, }: MarsRedBankMarketsQuery<TData>): any;
export interface MarsRedBankMarketQuery<TData> extends MarsRedBankReactQuery<Market, TData> {
    args: {
        denom: string;
    };
}
export declare function useMarsRedBankMarketQuery<TData = Market>({ client, args, options, }: MarsRedBankMarketQuery<TData>): any;
export interface MarsRedBankConfigQuery<TData> extends MarsRedBankReactQuery<ConfigForString, TData> {
}
export declare function useMarsRedBankConfigQuery<TData = ConfigForString>({ client, options, }: MarsRedBankConfigQuery<TData>): any;
export interface MarsRedBankUpdateAssetCollateralStatusMutation {
    client: MarsRedBankClient;
    msg: {
        denom: string;
        enable: boolean;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankUpdateAssetCollateralStatusMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankUpdateAssetCollateralStatusMutation>, 'mutationFn'>): any;
export interface MarsRedBankLiquidateMutation {
    client: MarsRedBankClient;
    msg: {
        collateralDenom: string;
        user: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankLiquidateMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankLiquidateMutation>, 'mutationFn'>): any;
export interface MarsRedBankRepayMutation {
    client: MarsRedBankClient;
    msg: {
        onBehalfOf?: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankRepayMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankRepayMutation>, 'mutationFn'>): any;
export interface MarsRedBankBorrowMutation {
    client: MarsRedBankClient;
    msg: {
        amount: Uint128;
        denom: string;
        recipient?: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankBorrowMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankBorrowMutation>, 'mutationFn'>): any;
export interface MarsRedBankWithdrawMutation {
    client: MarsRedBankClient;
    msg: {
        amount?: Uint128;
        denom: string;
        recipient?: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankWithdrawMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankWithdrawMutation>, 'mutationFn'>): any;
export interface MarsRedBankDepositMutation {
    client: MarsRedBankClient;
    msg: {
        onBehalfOf?: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankDepositMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankDepositMutation>, 'mutationFn'>): any;
export interface MarsRedBankUpdateUncollateralizedLoanLimitMutation {
    client: MarsRedBankClient;
    msg: {
        denom: string;
        newLimit: Uint128;
        user: string;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankUpdateUncollateralizedLoanLimitMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankUpdateUncollateralizedLoanLimitMutation>, 'mutationFn'>): any;
export interface MarsRedBankUpdateAssetMutation {
    client: MarsRedBankClient;
    msg: {
        denom: string;
        params: InitOrUpdateAssetParams;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankUpdateAssetMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankUpdateAssetMutation>, 'mutationFn'>): any;
export interface MarsRedBankInitAssetMutation {
    client: MarsRedBankClient;
    msg: {
        denom: string;
        params: InitOrUpdateAssetParams;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankInitAssetMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankInitAssetMutation>, 'mutationFn'>): any;
export interface MarsRedBankUpdateConfigMutation {
    client: MarsRedBankClient;
    msg: {
        config: CreateOrUpdateConfig;
    };
    args?: {
        fee?: number | StdFee | 'auto';
        memo?: string;
        funds?: Coin[];
    };
}
export declare function useMarsRedBankUpdateConfigMutation(options?: Omit<UseMutationOptions<ExecuteResult, Error, MarsRedBankUpdateConfigMutation>, 'mutationFn'>): any;
