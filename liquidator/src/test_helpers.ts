import { MsgExecuteContractEncodeObject, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { AccountData, Coin } from "@cosmjs/proto-signing";
import { readFileSync} from "fs";
import { toUtf8 } from "@cosmjs/encoding";

export async function sleep(timeout: number) {
    await new Promise((resolve) => setTimeout(resolve, timeout))
  }
  
// Reads json containing contract addresses located in /artifacts folder for specified network.
export function readAddresses() : ProtocolAddresses {
  try {
    const data = readFileSync(
      `addresses.json`,
      "utf8"
    );
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load addresses.json - please ensure a valid address.json file is located under /testing")
    process.exit(1)
  }
}



export const setPrice = async(client: SigningCosmWasmClient, deployerAddress: string, assetDenom : string, price: string, addresses : ProtocolAddresses) => {
const msg = {
    "set_price_source": {
        "denom": assetDenom,
        "price_source": {
            "fixed": { "price":  price}
        }
    }
  }

  await client.execute(deployerAddress,addresses.oracleContractAddress,msg,'auto')
}

// send OSMO and ATOM to next n number of addresses under our seed
export const seedAddresses = async(
  client : SigningCosmWasmClient, 
  sender: string,
  accounts : readonly AccountData[],
  coins : Coin[] ) : Promise<string[]> => {
    
  const seededAddresses : string[] = []
  const sendTokenMsgs = []

  console.log(`seeding children for ${sender}`)
  for (const accountIndex in accounts) {
    if (Number(accountIndex) == 0) continue

    const addressToSeed = accounts[accountIndex].address
    
    const msg = {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: {
          fromAddress: sender,
          toAddress: addressToSeed,
          amount: coins,
      },
    }

    sendTokenMsgs.push(msg)

    seededAddresses.push(addressToSeed)
  }

  await client.signAndBroadcast(
    sender,
    sendTokenMsgs,
    "auto",
  ) 

  return seededAddresses
}

export const withdraw = async(client: SigningCosmWasmClient, sender: string, assetDenom : string, amount : string, addresses : ProtocolAddresses) => {
  const msg = {
    "withdraw": {
      "denom": assetDenom,
      "amount": amount
    }
  }

  return await client.execute(sender, addresses.redBankContractAddress, msg, "auto")
}

export const borrow = async(client: SigningCosmWasmClient, sender: string, assetDenom : string, amount : string,addresses : ProtocolAddresses) => {
  const msg = {
      "borrow": {
        "denom": assetDenom,
        "amount": amount
    }
  }

  return await client.execute(sender, addresses.redBankContractAddress, msg, "auto")
}

export const makeDepositMessage = (
    sender: string, 
    assetDenom: string, 
    redBankContractAddress: string,
    coins: Coin[]) : MsgExecuteContractEncodeObject => {

  const executeContractMsg: MsgExecuteContractEncodeObject = {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender: sender,
      contract: redBankContractAddress,
      msg: toUtf8(`{ "deposit": { "denom": "${assetDenom}" } }`),
      funds: coins,
    },
  };

  return executeContractMsg
}

export const makeBorrowMessage = (
  sender: string, 
  assetDenom : string, 
  amount : string,
  redBankContractAddress : string) : MsgExecuteContractEncodeObject => {
    
const executeContractMsg: MsgExecuteContractEncodeObject = {
  typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
  value: {
    sender: sender,
    contract: redBankContractAddress,
    msg: toUtf8(`{ "borrow": { "denom": "${assetDenom}", "amount": "${amount}" }}`),
    funds: [],
  },
};

return executeContractMsg
}

export const deposit = async(client: SigningCosmWasmClient, sender: string, assetDenom : string, amount : string, addresses : ProtocolAddresses) => {
  const msg = { "deposit": { "denom": assetDenom } }
  const coins = [{
        "denom":assetDenom,
        "amount": amount 
    }]

  return await client.execute(sender, addresses.redBankContractAddress, msg, "auto", undefined, coins)
}

export const repay = async(client: SigningCosmWasmClient, sender: string, assetDenom : string, amount : string, addresses : ProtocolAddresses) => {
  const msg = { "repay": { "denom": assetDenom } }
  const coins = [{
        "denom":assetDenom,
        "amount": amount 
    }]

  return await client.execute(sender, addresses.redBankContractAddress, msg, "auto", undefined, coins)
}

export const queryHealth = async(client : SigningCosmWasmClient, address: string, addresses : ProtocolAddresses) => {
  const msg = { "user_position": { "user_address": address } }
  return await client.queryContractSmart(addresses.redBankContractAddress, msg)
}

export interface ProtocolAddresses {
  addressProviderContractAddress: string,
  liquidateFilterContractAddress: string,
  redBankContractAddress: string,
  incentivesContractAddress: string,
  oracleContractAddress: string,
  protocolRewardsCollectorContractAddress: string,
}

// Reads json containing contract addresses located in /artifacts folder for specified network.
export function readArtifact(name: string = "artifact") {
  try {
    const data = readFileSync(
      name,
      "utf8"
    );
    console.log(`loaded data`)
    console.log(data)
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

export interface Seed {
  mnemonic : string
  address: string
}

export const loadSeeds = () : Seed[] => {
  const data = readArtifact(`seeds.json`)
  console.log(data)
  return data
}


