import * as _9 from './MarsRedBank.types';
import * as _10 from './MarsRedBank.client';
import * as _11 from './MarsRedBank.react-query';
export declare namespace contracts {
    const MarsRedBank: {
        useMarsRedBankUnderlyingDebtAmountQuery<TData = string>({ client, args, options, }: _11.MarsRedBankUnderlyingDebtAmountQuery<TData>): any;
        useMarsRedBankUnderlyingLiquidityAmountQuery<TData_1 = string>({ client, args, options, }: _11.MarsRedBankUnderlyingLiquidityAmountQuery<TData_1>): any;
        useMarsRedBankScaledDebtAmountQuery<TData_2 = string>({ client, args, options, }: _11.MarsRedBankScaledDebtAmountQuery<TData_2>): any;
        useMarsRedBankScaledLiquidityAmountQuery<TData_3 = string>({ client, args, options, }: _11.MarsRedBankScaledLiquidityAmountQuery<TData_3>): any;
        useMarsRedBankUserPositionQuery<TData_4 = _9.UserPositionResponse>({ client, args, options, }: _11.MarsRedBankUserPositionQuery<TData_4>): any;
        useMarsRedBankUserCollateralsQuery<TData_5 = _9.ArrayOfUserCollateralResponse>({ client, args, options, }: _11.MarsRedBankUserCollateralsQuery<TData_5>): any;
        useMarsRedBankUserCollateralQuery<TData_6 = _9.UserCollateralResponse>({ client, args, options, }: _11.MarsRedBankUserCollateralQuery<TData_6>): any;
        useMarsRedBankUserDebtsQuery<TData_7 = _9.ArrayOfUserDebtResponse>({ client, args, options, }: _11.MarsRedBankUserDebtsQuery<TData_7>): any;
        useMarsRedBankUserDebtQuery<TData_8 = _9.UserDebtResponse>({ client, args, options, }: _11.MarsRedBankUserDebtQuery<TData_8>): any;
        useMarsRedBankUncollateralizedLoanLimitsQuery<TData_9 = _9.ArrayOfUncollateralizedLoanLimitResponse>({ client, args, options }: _11.MarsRedBankUncollateralizedLoanLimitsQuery<TData_9>): any;
        useMarsRedBankUncollateralizedLoanLimitQuery<TData_10 = _9.UncollateralizedLoanLimitResponse>({ client, args, options }: _11.MarsRedBankUncollateralizedLoanLimitQuery<TData_10>): any;
        useMarsRedBankMarketsQuery<TData_11 = _9.ArrayOfMarket>({ client, args, options, }: _11.MarsRedBankMarketsQuery<TData_11>): any;
        useMarsRedBankMarketQuery<TData_12 = _9.Market>({ client, args, options, }: _11.MarsRedBankMarketQuery<TData_12>): any;
        useMarsRedBankConfigQuery<TData_13 = _9.ConfigForString>({ client, options, }: _11.MarsRedBankConfigQuery<TData_13>): any;
        useMarsRedBankUpdateAssetCollateralStatusMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankUpdateAssetCollateralStatusMutation>, "mutationFn"> | undefined): any;
        useMarsRedBankLiquidateMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankLiquidateMutation>, "mutationFn"> | undefined): any;
        useMarsRedBankRepayMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankRepayMutation>, "mutationFn"> | undefined): any;
        useMarsRedBankBorrowMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankBorrowMutation>, "mutationFn"> | undefined): any;
        useMarsRedBankWithdrawMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankWithdrawMutation>, "mutationFn"> | undefined): any;
        useMarsRedBankDepositMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankDepositMutation>, "mutationFn"> | undefined): any;
        useMarsRedBankUpdateUncollateralizedLoanLimitMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankUpdateUncollateralizedLoanLimitMutation>, "mutationFn"> | undefined): any;
        useMarsRedBankUpdateAssetMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankUpdateAssetMutation>, "mutationFn"> | undefined): any;
        useMarsRedBankInitAssetMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankInitAssetMutation>, "mutationFn"> | undefined): any;
        useMarsRedBankUpdateConfigMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _11.MarsRedBankUpdateConfigMutation>, "mutationFn"> | undefined): any;
        marsRedBankQueryKeys: {
            contract: readonly [{
                readonly contract: "marsRedBank";
            }];
            address: (contractAddress: string | undefined) => readonly [{
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            config: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "config";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            market: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "market";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            markets: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "markets";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            uncollateralizedLoanLimit: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "uncollateralized_loan_limit";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            uncollateralizedLoanLimits: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "uncollateralized_loan_limits";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            userDebt: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "user_debt";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            userDebts: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "user_debts";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            userCollateral: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "user_collateral";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            userCollaterals: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "user_collaterals";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            userPosition: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "user_position";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            scaledLiquidityAmount: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "scaled_liquidity_amount";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            scaledDebtAmount: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "scaled_debt_amount";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            underlyingLiquidityAmount: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "underlying_liquidity_amount";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
            underlyingDebtAmount: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "underlying_debt_amount";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsRedBank";
            }];
        };
        MarsRedBankQueryClient: typeof _10.MarsRedBankQueryClient;
        MarsRedBankClient: typeof _10.MarsRedBankClient;
    };
}
