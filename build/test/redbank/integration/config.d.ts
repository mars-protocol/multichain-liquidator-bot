export interface TestConfig {
    seed: string;
    atomDenom: string;
    usdcDenom: string;
    gasDenom: string;
    osmoAtomPoolDenom: string;
    osmoUsdcPoolDenom: string;
    osmoAtomPoolId: number;
    osmoUsdcPoolId: number;
    liquidationFiltererAddress: string;
    redbankAddress: string;
    oracleAddress: string;
    rpcEndpoint: string;
    prefix: string;
    hiveEndpoint: string;
    lcdEndpoint: string;
    tests: {
        liquidateSingle: boolean;
        liquidateMany: boolean;
        liquidateBeatenFilterer: boolean;
    };
}
export declare const testnetConfig: TestConfig;
export declare const localnetConfig: TestConfig;
