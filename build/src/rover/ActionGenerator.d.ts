import { AMMRouter } from '../AmmRouter.js';
import { MarketInfo } from './types/MarketInfo.js';
import { Collateral, Debt, PositionType } from './types/RoverPosition.js';
import { Action, Coin, VaultPositionType } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types';
import { UncollateralizedLoanLimitResponse, UserDebtResponse } from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types';
import { VaultInfo } from '../query/types.js';
export declare class ActionGenerator {
    private router;
    constructor(osmosisRouter: AMMRouter);
    produceBorrowActions: (debt: Debt, collateral: Collateral, markets: MarketInfo[], whitelistedAssets: string[], creditLines: UserDebtResponse[], creditLineCaps: UncollateralizedLoanLimitResponse[]) => Action[];
    borrowWithoutLiquidity: (debtCoin: Coin, markets: MarketInfo[], whitelistedAssets: string[]) => Action[];
    generateSwapActions: (assetInDenom: string, assetOutDenom: string, amount: string, slippage: string) => Promise<Action>;
    produceRefundAllAction: () => Action;
    produceLiquidationAction: (positionType: PositionType, debtCoin: Coin, liquidateeAccountId: string, requestCoinDenom: string, vaultPositionType?: VaultPositionType) => Action;
    produceVaultToDebtActions: (vault: VaultInfo, borrow: Coin, slippage: string, prices: Map<string, number>) => Promise<Action[]>;
    produceWithdrawLiquidityAction: (lpTokenDenom: string) => Action;
    generateRepayActions: (debtDenom: string) => Action[];
    convertCollateralToDebt: (collateralDenom: string, borrow: Coin, vault: VaultInfo | undefined, slippage: string, prices: Map<string, number>) => Promise<Action[]>;
    swapCollateralCoinToBorrowActions: (collateralDenom: string, borrowed: Coin, slippage: string, prices: Map<string, number>) => Promise<Action[]>;
    private produceLiquidateCoin;
    private produceLiquidateVault;
    private produceRepayAction;
    private produceSwapAction;
    private produceBorrowAction;
}
