import { CosmWasmClient, MsgExecuteContractEncodeObject, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { AccountData, Coin, DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import { readFileSync } from 'fs'
import { toUtf8 } from '@cosmjs/encoding'
import { osmosis } from 'osmojs'
import { MsgSwapExactAmountIn, SwapAmountInRoute } from 'osmojs/types/codegen/osmosis/gamm/v1beta1/tx'
import { SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import camelcaseKeys from 'camelcase-keys'

const { swapExactAmountIn } = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl
osmosis.gamm.v1beta1.MsgSwapExactAmountIn

export async function sleep(timeout: number) {
  await new Promise((resolve) => setTimeout(resolve, timeout))
}

// Reads json containing contract addresses located in /artifacts folder for specified network.
export function readAddresses(deployConfigPath: string): ProtocolAddresses {
  try {
    const data = readFileSync(deployConfigPath, 'utf8')
    const deployData: { addresses: ProtocolAddresses } = JSON.parse(data)
    const result: ProtocolAddresses = camelcaseKeys(deployData.addresses)

    return result
  } catch (e) {
    console.error(`Failed to load artifacts path - could not find ${deployConfigPath}`)
    process.exit(1)
  }
}

export const produceSigningStargateClient = async(rpcEndpoint: string, liquidator: DirectSecp256k1HdWallet) : Promise<SigningStargateClient> => {
  const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, liquidator)

  const executeTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract'
  client.registry.register(executeTypeUrl, MsgExecuteContract)

  return client
}

export const produceReadOnlyCosmWasmClient = async(rpcEndpoint : string, liquidator : DirectSecp256k1HdWallet) : Promise<CosmWasmClient> => {
  return await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, liquidator)
}


export const setPrice = async (
  client: SigningCosmWasmClient,
  deployerAddress: string,
  assetDenom: string,
  price: string,
  addresses: ProtocolAddresses,
) => {
  const msg = {
    set_price_source: {
      denom: assetDenom,
      price_source: {
        fixed: { price: price },
      },
    },
  }

  await client.execute(deployerAddress, addresses.oracle, msg, 'auto')
}

// send OSMO and ATOM to next n number of addresses under our seed
export const seedAddresses = async (
  client: SigningCosmWasmClient,
  sender: string,
  accounts: readonly AccountData[],
  coins: Coin[],
): Promise<string[]> => {
  const seededAddresses: string[] = []
  const sendTokenMsgs: EncodeObject[] = []

  console.log(`seeding children for ${sender}`)
  accounts.forEach((account) => {
    if (account.address === sender) return

    const addressToSeed = account.address

    const msg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: {
        fromAddress: sender,
        toAddress: addressToSeed,
        amount: coins,
      },
    }

    sendTokenMsgs.push(msg)
    seededAddresses.push(addressToSeed)
  })

  await client.signAndBroadcast(sender, sendTokenMsgs, 'auto')

  return seededAddresses
}

export const withdraw = async (
  client: SigningCosmWasmClient,
  sender: string,
  assetDenom: string,
  amount: string,
  addresses: ProtocolAddresses,
) => {
  const msg = {
    withdraw: {
      denom: assetDenom,
      amount: amount,
    },
  }

  return await client.execute(sender, addresses.redBank, msg, 'auto')
}

export const borrow = async (
  client: SigningCosmWasmClient,
  sender: string,
  assetDenom: string,
  amount: string,
  addresses: ProtocolAddresses,
) => {
  const msg = {
    borrow: {
      denom: assetDenom,
      amount: amount,
    },
  }

  return await client.execute(sender, addresses.redBank, msg, 'auto')
}

export const makeExecuteContractMessage = (
  sender: string,
  contract: string,
  msg: Uint8Array,
funds: Coin[] = []
) : MsgExecuteContractEncodeObject => {
  const executeContractMsg: MsgExecuteContractEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: {
      sender,
      contract,
      msg,
      funds,
    },
  }

  return executeContractMsg
}

export const makeDepositMessage = (
  sender: string,
  assetDenom: string,
  redBankContractAddress: string,
  coins: Coin[],
): MsgExecuteContractEncodeObject => {
  const executeContractMsg: MsgExecuteContractEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: {
      sender: sender,
      contract: redBankContractAddress,
      msg: toUtf8(`{ "deposit": {} }`),
      funds: coins,
    },
  }

  return executeContractMsg
}

export const makeBorrowMessage = (
  sender: string,
  assetDenom: string,
  amount: string,
  redBankContractAddress: string,
): MsgExecuteContractEncodeObject => {
  const executeContractMsg: MsgExecuteContractEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: {
      sender: sender,
      contract: redBankContractAddress,
      msg: toUtf8(`{ "borrow": { "denom": "${assetDenom}", "amount": "${amount}" }}`),
      funds: [],
    },
  }

  return executeContractMsg
}

export const makeWithdrawMessage = (
  sender: string,
  assetDenom: string,
  redBankContractAddress: string,
): MsgExecuteContractEncodeObject => {
  const msg = toUtf8(`
      { 
        "withdraw": { 
          "denom": "${assetDenom}"
        } 
      }`)
  return makeExecuteContractMessage(sender, redBankContractAddress, msg, [])
}

interface MsgSwapEncodeObject {
  typeUrl: string
  value: MsgSwapExactAmountIn
}

export const makeRepayMessage = (
  sender: string,
  redBankContractAddress: string,
  coins: Coin[],
): MsgExecuteContractEncodeObject => {
  const executeContractMsg: MsgExecuteContractEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: {
      sender: sender,
      contract: redBankContractAddress,
      msg: toUtf8(`{ "repay" : {} }`),
      funds: coins,
    },
  }

  return executeContractMsg
}

export const makeSwapMessage = (
  liquidatorAddress: string,
  tokenIn: Coin,
  route: SwapAmountInRoute[],
): MsgSwapEncodeObject => {
  // create the message
  const msg = swapExactAmountIn({
    sender: liquidatorAddress,
    routes: route,
    tokenIn: tokenIn,

    // TODO: make this amount at least what we repaid so we don't lose money? OR do we just not liquidate at all
    tokenOutMinAmount: '1',
  })

  const executeContractMsg: MsgSwapEncodeObject = {
    typeUrl: msg.typeUrl,
    value: msg.value,
  }

  return executeContractMsg
}

export const deposit = async (
  client: SigningCosmWasmClient,
  sender: string,
  assetDenom: string,
  amount: string,
  addresses: ProtocolAddresses,
) => {
  const msg = { deposit: {} }
  const coins = [
    {
      denom: assetDenom,
      amount: amount,
    },
  ]

  console.log({
    redbank: addresses.redBank,
    msg
  })
  return await client.execute(sender, addresses.redBank, msg, 'auto', undefined, coins)
}

export const repay = async (
  client: SigningCosmWasmClient,
  sender: string,
  assetDenom: string,
  amount: string,
  addresses: ProtocolAddresses,
) => {
  const msg = { repay: { denom: assetDenom } }
  const coins = [
    {
      denom: assetDenom,
      amount: amount,
    },
  ]

  return await client.execute(sender, addresses.redBank, msg, 'auto', undefined, coins)
}

export const queryHealth = async (
  client: CosmWasmClient,
  address: string,
  addresses: ProtocolAddresses,
) => {
  const msg = { user_position: { user: address } }
  return await client.queryContractSmart(addresses.redBank, msg)
}

export interface ProtocolAddresses {
  addressProvider: string
  filterer: string
  redBank: string
  incentives: string
  oracle: string
  rewardsCollector: string
}

// Reads json containing contract addresses located in /artifacts folder for specified network.
export function readArtifact(name: string = 'artifact') {
  try {
    const data = readFileSync(name, 'utf8')
    return JSON.parse(data)
  } catch (e) {
    return {}
  }
}

export interface Seed {
  mnemonic: string
  address: string
}

export const loadSeeds = (): Seed[] => {
  const data = readArtifact(`seeds.json`)

  return data
}
