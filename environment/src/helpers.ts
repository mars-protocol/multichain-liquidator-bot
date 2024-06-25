import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate"
import { DirectSecp256k1HdWallet, GeneratedType, Registry } from "@cosmjs/proto-signing"
import { AminoTypes, GasPrice, SigningStargateClient } from "@cosmjs/stargate"
import path from "path"
import { setPrice, readAddresses } from "../../src/helpers.js"
import "dotenv/config.js"

import { 
  cosmosAminoConverters,
  cosmosProtoRegistry,
  cosmwasmAminoConverters,
  cosmwasmProtoRegistry,
  ibcProtoRegistry,
  ibcAminoConverters,
  osmosisAminoConverters,
  osmosisProtoRegistry
} from 'osmojs';

export const requiredEnvironmentVariables = (envVars: string[]) => {
    let missing = envVars.filter((v) => process.env[v] === undefined)
  
    if (missing.length > 0) {
      console.error(
        `Required environment variables are not set: ${missing.join(', ')}`
      )
      process.exit(1)
    }
  }

export const recoverWallet = async(seed: string) : Promise<DirectSecp256k1HdWallet> => {
    return await DirectSecp256k1HdWallet.fromMnemonic(seed, { prefix: 'osmo'} );
}

export const createClient = async(wallet : DirectSecp256k1HdWallet) : Promise<SigningCosmWasmClient> => {
    

      const protoRegistry: ReadonlyArray<[string, GeneratedType]> = [
        ...cosmosProtoRegistry,
        ...cosmwasmProtoRegistry,
        ...ibcProtoRegistry,
        ...osmosisProtoRegistry
    ];
    
    const aminoConverters = {
        ...cosmosAminoConverters,
        ...cosmwasmAminoConverters,
        ...ibcAminoConverters,
        ...osmosisAminoConverters
    };
    
    const registry = new Registry(protoRegistry);
    const aminoTypes = new AminoTypes(aminoConverters);
    const clientOption: SigningCosmWasmClientOptions = {
      gasPrice: GasPrice.fromString("0.01uosmo"),
      registry,
      aminoTypes
    }
    return await SigningCosmWasmClient.connectWithSigner(process.env.RPC_URL!, wallet, clientOption);
}

export const createStargateClient = async(wallet : DirectSecp256k1HdWallet) : Promise<SigningStargateClient> => {
    

  const protoRegistry: ReadonlyArray<[string, GeneratedType]> = [
    ...cosmosProtoRegistry,
    ...cosmwasmProtoRegistry,
    ...ibcProtoRegistry,
    ...osmosisProtoRegistry
];

const aminoConverters = {
    ...cosmosAminoConverters,
    ...cosmwasmAminoConverters,
    ...ibcAminoConverters,
    ...osmosisAminoConverters
};

const registry = new Registry(protoRegistry);
const aminoTypes = new AminoTypes(aminoConverters);
const clientOption: SigningCosmWasmClientOptions = {
  gasPrice: GasPrice.fromString("0.01uosmo"),
  registry,
  aminoTypes
}
return await SigningStargateClient.connectWithSigner(process.env.RPC_URL!, wallet, clientOption);
}

export const setAtomOraclePrice = async(price : string) => {

   // create client - todo use helper once 
   const wallet = await DirectSecp256k1HdWallet.fromMnemonic(process.env.DEPLOYER_SEED!, { prefix: 'osmo' });
   const accounts = await wallet.getAccounts()
   const deployDetails = path.join(process.env.OUTPOST_ARTIFACTS_PATH!, `${process.env.CHAIN_ID}.json`)
   const addresses = readAddresses(deployDetails)    

   const clientOption: SigningCosmWasmClientOptions = {
       gasPrice: GasPrice.fromString("0.01uosmo")
   }

   const client = await SigningCosmWasmClient.connectWithSigner(process.env.RPC_URL!, wallet, clientOption);

    //@ts-ignore
   await setPrice(client,accounts[0].address, process.env.ATOM_DENOM!, price,addresses)
}