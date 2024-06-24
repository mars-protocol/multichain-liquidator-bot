import { UncollateralizedLoanLimitResponse, UserDebtResponse } from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types';
import { MarketInfo } from '../../../src/rover/types/MarketInfo';
export declare const generateRandomMarket: (denom?: string) => MarketInfo;
export declare const generateRandomCreditLine: (denom?: string, amount?: string) => UserDebtResponse;
export declare const generateRandomCreditLineCap: (denom?: string, limit?: string) => UncollateralizedLoanLimitResponse;
