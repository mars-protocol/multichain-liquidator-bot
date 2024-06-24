import { LiquidationTx } from '../types/liquidation.js';
import { Coin, SigningStargateClient } from '@cosmjs/stargate';
import { EncodeObject } from '@cosmjs/proto-signing';
import 'dotenv/config.js';
import BigNumber from 'bignumber.js';
import { BaseExecutor, BaseExecutorConfig } from '../BaseExecutor';
import { CosmWasmClient, MsgExecuteContractEncodeObject } from '@cosmjs/cosmwasm-stargate';
import { Collateral, DataResponse } from '../query/types.js';
import { PoolDataProviderInterface } from '../query/amm/PoolDataProviderInterface.js';
import { ExchangeInterface } from '../execute/ExchangeInterface.js';
import { RouteRequesterInterface } from '../query/amm/RouteRequesterInterface.js';
export interface RedbankExecutorConfig extends BaseExecutorConfig {
    liquidationFiltererAddress: string;
    liquidatableAssets: string[];
    safetyMargin: number;
    astroportApi: string;
}
export declare class RedbankExecutor extends BaseExecutor {
    private exchangeInterface;
    private routeRequestApi;
    config: RedbankExecutorConfig;
    constructor(config: RedbankExecutorConfig, client: SigningStargateClient, queryClient: CosmWasmClient, poolProvider: PoolDataProviderInterface, exchangeInterface: ExchangeInterface, routeRequestApi: RouteRequesterInterface);
    start(): Promise<void>;
    produceLiquidationTxs(positionData: DataResponse[]): {
        txs: LiquidationTx[];
        debtsToRepay: Map<string, BigNumber>;
    };
    appendWithdrawMessages(collateralsWon: Collateral[], liquidatorAddress: string, msgs: EncodeObject[]): EncodeObject[];
    appendSwapToNeutralMessages(collaterals: Coin[], liquidatorAddress: string, msgs: EncodeObject[]): Promise<BigNumber>;
    appendSwapToDebtMessages(debtsToRepay: Coin[], liquidatorAddress: string, msgs: EncodeObject[], neutralAvailable: BigNumber): Promise<Map<string, BigNumber>>;
    executeViaRedbankMsg: (tx: LiquidationTx) => MsgExecuteContractEncodeObject;
    executeViaFilterer: (txs: LiquidationTx[], debtCoins: Coin[]) => MsgExecuteContractEncodeObject;
    run(): Promise<void>;
    runLiquidation: (liquidateeAddress: string, liquidatorAddress: string) => Promise<void>;
    withdrawAndSwapCollateral: (liquidatorAddress: string) => Promise<void>;
    combineBalances(collaterals: Collateral[], balances: readonly Coin[]): Coin[];
    getFee: (msgs: EncodeObject[], address: string) => Promise<{
        amount: Coin[];
        gas: string;
    }>;
}
