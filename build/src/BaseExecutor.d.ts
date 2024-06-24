import { SigningStargateClient } from '@cosmjs/stargate';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { RedisInterface } from './redis.js';
import { AMMRouter } from './AmmRouter.js';
import 'dotenv/config.js';
import { MarketInfo } from './rover/types/MarketInfo.js';
import { Row } from './CsvWriter.js';
import { PoolDataProviderInterface } from './query/amm/PoolDataProviderInterface.js';
export interface BaseExecutorConfig {
    lcdEndpoint: string;
    chainName: string;
    hiveEndpoint: string;
    oracleAddress: string;
    redbankAddress: string;
    liquidatorMasterAddress: string;
    gasDenom: string;
    neutralAssetDenom: string;
    logResults: boolean;
    redisEndpoint: string;
    poolsRefreshWindow: number;
    astroportFactory?: string;
    astroportRouter?: string;
    marsEndpoint?: string;
    chainId?: string;
}
export declare class BaseExecutor {
    config: BaseExecutorConfig;
    client: SigningStargateClient;
    queryClient: CosmWasmClient;
    private poolProvider;
    redis: RedisInterface;
    ammRouter: AMMRouter;
    prices: Map<string, number>;
    balances: Map<string, number>;
    markets: MarketInfo[];
    private poolsNextRefresh;
    private csvLogger;
    constructor(config: BaseExecutorConfig, client: SigningStargateClient, queryClient: CosmWasmClient, poolProvider: PoolDataProviderInterface, redis?: RedisInterface, ammRouter?: AMMRouter);
    initiateRedis(): Promise<void>;
    initiateAstroportPoolProvider(): Promise<void>;
    applyAvailableLiquidity: (market: MarketInfo) => MarketInfo;
    setBalances: (liquidatorAddress: string) => Promise<void>;
    addCsvRow: (row: Row) => void;
    writeCsv: () => Promise<void>;
    refreshData: () => Promise<void>;
    refreshMarketData: () => Promise<void>;
    refreshPoolData: () => Promise<void>;
}
