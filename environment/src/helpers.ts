import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate"
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing"
import { GasPrice } from "@cosmjs/stargate"
import path from "path"
import { setPrice, readAddresses } from "../../liquidator/src/helpers.js"
import "dotenv/config.js"


export const requiredEnvironmentVariables = (envVars: string[]) => {
    let missing = envVars.filter((v) => process.env[v] === undefined)
  
    if (missing.length > 0) {
      console.error(
        `Required environment variables are not set: ${missing.join(', ')}`
      )
      process.exit(1)
    }
  }

export const setAtomOraclePrice = async(price : string) => {

   // create client - todo use helper once 
   const wallet = await DirectSecp256k1HdWallet.fromMnemonic(process.env.DEPLOYER_SEED!, { prefix: 'osmo' });
   const accounts = await wallet.getAccounts()
   const deployDetails = path.join(process.env.OUTPOST_ARTIFACTS_PATH!, `${process.env.CHAIN_ID}.json`)
   const addresses = readAddresses(deployDetails)    

   const clientOption: SigningCosmWasmClientOptions = {
       gasPrice: GasPrice.fromString("0.1uosmo")
   }

   const client = await SigningCosmWasmClient.connectWithSigner(process.env.RPC_URL!, wallet, clientOption);

   await setPrice(client,accounts[0].address, process.env.ATOM_DENOM!, price,addresses)
}