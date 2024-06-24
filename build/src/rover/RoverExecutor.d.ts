import { BaseExecutor, BaseExecutorConfig } from '../BaseExecutor';
import { Coin, VaultInfoResponse, VaultPosition, VaultPositionType } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types';
import BigNumber from 'bignumber.js';
import { Collateral, Debt } from './types/RoverPosition';
import { SigningStargateClient } from '@cosmjs/stargate';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { PoolDataProviderInterface } from '../query/amm/PoolDataProviderInterface';
interface CreateCreditAccountResponse {
    tokenId: number;
    liquidatorAddress: string;
}
export interface RoverExecutorConfig extends BaseExecutorConfig {
    creditManagerAddress: string;
    swapperAddress: string;
    accountNftAddress: string;
    minGasTokens: number;
    maxLiquidators: number;
    stableBalanceThreshold: number;
}
export declare class RoverExecutor extends BaseExecutor {
    private VAULT_RELOAD_WINDOW;
    config: RoverExecutorConfig;
    private liquidationActionGenerator;
    private creditLines;
    private creditLineCaps;
    private liquidatorAccounts;
    private liquidatorBalances;
    private whitelistedCoins;
    private vaults;
    private vaultDetails;
    private lastFetchedVaultTime;
    private wallet;
    constructor(config: RoverExecutorConfig, client: SigningStargateClient, queryClient: CosmWasmClient, wallet: DirectSecp256k1HdWallet, poolProvider: PoolDataProviderInterface);
    start: () => Promise<void>;
    updateLiquidatorBalances: () => Promise<void>;
    topUpWallets: (addresses: string[]) => Promise<void>;
    fetchVaults: () => Promise<VaultInfoResponse[]>;
    refreshData: () => Promise<void>;
    createCreditAccount: (liquidatorAddress: string) => Promise<CreateCreditAccountResponse>;
    run: () => Promise<void>;
    liquidate: (accountId: string, liquidatorAddress: string) => Promise<void>;
    findBestCollateral: (collaterals: Coin[], vaultPositions: VaultPosition[]) => Collateral;
    calculateCoinValue: (coin: Coin | undefined) => number;
    calculateVaultSharesValue: (shares: BigNumber, vaultAddress: string) => BigNumber;
    calculateVaultValue: (vault: VaultPosition | undefined) => {
        value: number;
        type: VaultPositionType;
    };
    findBestDebt: (debts: Coin[]) => Debt;
}
export {};
