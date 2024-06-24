import { Position } from '../types/position';
import { Coin, Positions } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types';
import { MarketInfo } from '../rover/types/MarketInfo';
import { PriceResponse } from 'marsjs-types/creditmanager/generated/mars-mock-oracle/MarsMockOracle.types';
import { DataResponse, RoverData } from './types';
export declare const fetchRoverData: (hiveEndpoint: string, address: string, redbankAddress: string, oracleAddress: string, creditManagerAddress: string, swapperAddress: string, vaultAddresses: string[]) => Promise<RoverData>;
export declare const fetchRedbankData: (hiveEndpoint: string, address: string, redbankAddress: string, oracleAddress: string) => Promise<{
    bank: {
        balance: Coin[];
    };
    wasm: {
        markets: MarketInfo[];
        prices: PriceResponse[];
        whitelistedAssets?: string[];
    };
}>;
export declare const fetchRoverPosition: (accountId: string, creditManagerAddress: string, hiveEndpoint: string) => Promise<Positions>;
export declare const fetchRedbankBatch: (positions: Position[], redbankAddress: string, hiveEndpoint: string) => Promise<DataResponse[]>;
export declare const fetchBalances: (hiveEndpoint: string, addresses: string[]) => Promise<Map<string, Coin[]>>;
