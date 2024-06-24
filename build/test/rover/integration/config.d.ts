export interface TestConfig {
    seed: string;
    atomDenom: string;
    usdcDenom: string;
    gasDenom: string;
    osmoAtomPoolDenom: string;
    osmoUsdcPoolDenom: string;
    osmoAtomPoolId: number;
    osmoUsdcPoolId: number;
    vaults: string[];
    accountNFTAddress: string;
    creditManagerAddress: string;
    redbankAddress: string;
    oracleAddress: string;
    swapperAddress: string;
    rpcEndpoint: string;
    prefix: string;
    seedRedbankRequired: boolean;
    hiveEndpoint: string;
    lcdEndpoint: string;
    tests: {
        simpleCoin: boolean;
        marketDisabled: boolean;
        coinDisabled: boolean;
        lpTokenCollateral: boolean;
        creditLineExceeded: boolean;
        illiquidRedbank: boolean;
        lockedVault: boolean;
        unlockingVault: boolean;
        unlockedVault: boolean;
        liquidateMany: boolean;
    };
}
export declare const testnetConfig: TestConfig;
export declare const localnetConfig: TestConfig;
