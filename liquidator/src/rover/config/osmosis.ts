import { Network } from "../../types/network";
import { RoverExecutorConfig } from "../executor";

export const getConfig = (liquidatorMasterAddress: string, liquidatorAddress: string, network: Network): RoverExecutorConfig => {

    if (network === Network.MAINNET) throw new Error("Mainnet network not yet supported")

    return {
        gasDenom: process.env.GAS_DENOM!,
        hiveEndpoint: process.env.HIVE_ENDPOINT!,
        lcdEndpoint: process.env.LCD_ENDPOINT!,
        neutralAssetDenom: process.env.NEUTRAL_ASSET_DENOM!,
        oracleAddress: process.env.ORACLE_ADDRESS!,
        swapperAddress: process.env.SWAPPER_ADDRESS!,
        redbankAddress: process.env.REDBANK_ADDRESS!,
        accountNftAddress: process.env.ACCOUNT_NFT_ADDRESS!,
        creditManagerAddress: process.env.CREDIT_MANAGER_ADDRESS!,
        liquidatorMasterAddress: liquidatorMasterAddress,
        liquidatorAddress: liquidatorAddress,
        minGasTokens: Number(process.env.MIN_GAS_TOKENS!),
        logResults: false,
        redisEndpoint: process.env.REDIS_ENDPOINT!
      }
} 