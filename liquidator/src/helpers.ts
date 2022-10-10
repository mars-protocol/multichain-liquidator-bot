import { MsgExecuteContractEncodeObject, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { AccountData, coin, Coin, EncodeObject } from '@cosmjs/proto-signing'
import { readFileSync } from 'fs'
import { toUtf8 } from '@cosmjs/encoding'
import { osmosis } from 'osmojs'
import { MsgSwapExactAmountIn, SwapAmountInRoute } from 'osmojs/types/proto/osmosis/gamm/v1beta1/tx'
const { swapExactAmountIn } = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl

export async function sleep(timeout: number) {
  await new Promise((resolve) => setTimeout(resolve, timeout))
}

// Reads json containing contract addresses located in /artifacts folder for specified network.
export function readAddresses(deployConfigPath: string): ProtocolAddresses {
  try {
    const data = readFileSync(deployConfigPath, 'utf8')
    const deployData : {addresses : ProtocolAddresses} = JSON.parse(data)
    const result : ProtocolAddresses = deployData.addresses
    return result
  } catch (e) {
    console.error(`Failed to load artifacts path - could not find ${deployConfigPath}`)
    process.exit(1)
  }
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
  const sendTokenMsgs : EncodeObject[] = []

  console.log(`seeding children for ${sender}`)
  accounts.forEach((account)=> {
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
      msg: toUtf8(`{ "deposit": { "denom": "${assetDenom}" } }`),
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
  recipient: string,
): MsgExecuteContractEncodeObject => {
  const executeContractMsg: MsgExecuteContractEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: {
      sender: sender,
      contract: redBankContractAddress,
      msg: toUtf8(`
      { 
        "withdraw": { 
          "denom": "${assetDenom}",
          "recipient": "${recipient}" 
        } 
      }`),
      funds: [],
    },
  }

  return executeContractMsg
}

export const makeSwapMessage = (
  liquidatorAddress: string,
  assetInDenom: string,
  assetOutDenom: string,
  assetInAmount: number,
  route: SwapAmountInRoute[]
) : MsgSwapExactAmountIn => {

  // create the message
  const msg = swapExactAmountIn({
    sender: liquidatorAddress,
    routes: route,
    tokenIn: coin(assetInAmount, assetInDenom),

    // TODO: make this amount at least what we repaid so we don't lose money
    tokenOutMinAmount: '1',
  })

  return msg.value
}



export const deposit = async (
  client: SigningCosmWasmClient,
  sender: string,
  assetDenom: string,
  amount: string,
  addresses: ProtocolAddresses,
) => {
  const msg = { deposit: { denom: assetDenom } }
  const coins = [
    {
      denom: assetDenom,
      amount: amount,
    },
  ]

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
  client: SigningCosmWasmClient,
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
    console.log(`loaded data`)
    console.log(data)
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
  console.log(data)
  return data
}
