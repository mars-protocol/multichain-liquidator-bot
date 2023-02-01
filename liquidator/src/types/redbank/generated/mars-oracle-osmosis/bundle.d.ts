import * as _6 from './MarsOracleOsmosis.types';
import * as _7 from './MarsOracleOsmosis.client';
import * as _8 from './MarsOracleOsmosis.react-query';
export declare namespace contracts {
    const MarsOracleOsmosis: {
        useMarsOracleOsmosisPricesQuery<TData = _6.ArrayOfPriceResponse>({ client, args, options, }: _8.MarsOracleOsmosisPricesQuery<TData>): any;
        useMarsOracleOsmosisPriceQuery<TData_1 = _6.PriceResponse>({ client, args, options, }: _8.MarsOracleOsmosisPriceQuery<TData_1>): any;
        useMarsOracleOsmosisPriceSourcesQuery<TData_2 = _6.ArrayOfPriceSourceResponseForString>({ client, args, options, }: _8.MarsOracleOsmosisPriceSourcesQuery<TData_2>): any;
        useMarsOracleOsmosisPriceSourceQuery<TData_3 = _6.PriceSourceResponseForString>({ client, args, options, }: _8.MarsOracleOsmosisPriceSourceQuery<TData_3>): any;
        useMarsOracleOsmosisConfigQuery<TData_4 = _6.ConfigForString>({ client, options, }: _8.MarsOracleOsmosisConfigQuery<TData_4>): any;
        useMarsOracleOsmosisSetPriceSourceMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _8.MarsOracleOsmosisSetPriceSourceMutation>, "mutationFn"> | undefined): any;
        useMarsOracleOsmosisUpdateConfigMutation(options?: Omit<UseMutationOptions<import("@cosmjs/cosmwasm-stargate").ExecuteResult, Error, _8.MarsOracleOsmosisUpdateConfigMutation>, "mutationFn"> | undefined): any;
        marsOracleOsmosisQueryKeys: {
            contract: readonly [{
                readonly contract: "marsOracleOsmosis";
            }];
            address: (contractAddress: string | undefined) => readonly [{
                readonly address: string | undefined;
                readonly contract: "marsOracleOsmosis";
            }];
            config: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "config";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsOracleOsmosis";
            }];
            priceSource: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "price_source";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsOracleOsmosis";
            }];
            priceSources: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "price_sources";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsOracleOsmosis";
            }];
            price: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "price";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsOracleOsmosis";
            }];
            prices: (contractAddress: string | undefined, args?: Record<string, unknown> | undefined) => readonly [{
                readonly method: "prices";
                readonly args: Record<string, unknown> | undefined;
                readonly address: string | undefined;
                readonly contract: "marsOracleOsmosis";
            }];
        };
        MarsOracleOsmosisQueryClient: typeof _7.MarsOracleOsmosisQueryClient;
        MarsOracleOsmosisClient: typeof _7.MarsOracleOsmosisClient;
    };
}
