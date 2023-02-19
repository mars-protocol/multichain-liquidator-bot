import {
	CosmWasmClient,
	MsgExecuteContractEncodeObject,
	SigningCosmWasmClient,
	SigningCosmWasmClientOptions,
} from '@cosmjs/cosmwasm-stargate'
import {
	AccountData,
	Coin,
	DirectSecp256k1HdWallet,
	EncodeObject,
	GeneratedType,
	Registry,
} from '@cosmjs/proto-signing'
import { readFileSync } from 'fs'
import { toUtf8 } from '@cosmjs/encoding'
import {
	cosmosAminoConverters,
	cosmosProtoRegistry,
	cosmwasmAminoConverters,
	cosmwasmProtoRegistry,
	ibcAminoConverters,
	ibcProtoRegistry,
	osmosis,
	osmosisAminoConverters,
	osmosisProtoRegistry,
} from 'osmojs'
import {
	MsgSwapExactAmountIn,
	SwapAmountInRoute,
} from 'osmojs/types/codegen/osmosis/gamm/v1beta1/tx'
import { AminoTypes, GasPrice, MsgSendEncodeObject, SigningStargateClient } from '@cosmjs/stargate'
import { camelCase } from 'lodash'
import { HdPath } from '@cosmjs/crypto'
import { Pool } from './types/Pool'

const { swapExactAmountIn } = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl
osmosis.gamm.v1beta1.MsgSwapExactAmountIn

export async function sleep(timeout: number) {
	await new Promise((resolve) => setTimeout(resolve, timeout))
}

export const camelCaseKeys = (object: Object) => {
	const newObject = {}
	//@ts-ignore tells us that we cannot 'use string to index {}' but we can :)
	Object.keys(object).forEach((key) => (newObject[camelCase(key)] = object[key]))
	return newObject
}

// Reads json containing contract addresses located in /artifacts folder for specified network.
export function readAddresses(deployConfigPath: string): ProtocolAddresses {
	try {
		const data = readFileSync(deployConfigPath, 'utf8')
		const deployData: { addresses: ProtocolAddresses } = JSON.parse(data)

		return camelCaseKeys(deployData.addresses) as ProtocolAddresses
	} catch (e) {
		console.error(`Failed to load artifacts path - could not find ${deployConfigPath}`)
		process.exit(1)
	}
}

export const getWallet = async (
	mnemonic: string,
	prefix: string,
	hdPaths?: HdPath[],
): Promise<DirectSecp256k1HdWallet> => {
	const options = hdPaths ? { hdPaths, prefix } : { prefix }
	return await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, options)
}

export const getAddress = async (wallet: DirectSecp256k1HdWallet): Promise<string> => {
	const accounts = await wallet.getAccounts()
	return accounts[0].address
}

export const produceSigningStargateClient = async (
	rpcEndpoint: string,
	liquidator: DirectSecp256k1HdWallet,
	gasPrice: string = '0.0025uosmo',
): Promise<SigningStargateClient> => {
	const protoRegistry: ReadonlyArray<[string, GeneratedType]> = [
		...cosmosProtoRegistry,
		...cosmwasmProtoRegistry,
		...ibcProtoRegistry,
		...osmosisProtoRegistry,
	]

	const aminoConverters = {
		...cosmosAminoConverters,
		...cosmwasmAminoConverters,
		...ibcAminoConverters,
		...osmosisAminoConverters,
	}

	const registry = new Registry(protoRegistry)
	const aminoTypes = new AminoTypes(aminoConverters)
	const clientOption: SigningCosmWasmClientOptions = {
		gasPrice: GasPrice.fromString(gasPrice),
		registry,
		aminoTypes,
	}

	return await SigningStargateClient.connectWithSigner(rpcEndpoint, liquidator, clientOption)
}

export const produceReadOnlyCosmWasmClient = async (
	rpcEndpoint: string,
): Promise<CosmWasmClient> => {
	return await SigningCosmWasmClient.connect(rpcEndpoint)
}

export const produceSigningCosmWasmClient = async (
	rpcEndpoint: string,
	liquidator: DirectSecp256k1HdWallet,
	gasPrice: string = '0.0025uosmo',
): Promise<SigningCosmWasmClient> => {
	return await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, liquidator, {
		gasPrice: GasPrice.fromString(gasPrice),
	})
}

export const findUnderlying = (lpToken: string, pools: Pool[]) : string[] | undefined  => {
  const poolId = lpToken.split("/").pop()
  const pool = pools.find((pool)=> pool.id.toString() === poolId)
  if (!pool) return undefined

  return pool.poolAssets.map((pool)=> pool.token.denom)
}

export const setPrice = async (
	client: SigningCosmWasmClient,
	deployerAddress: string,
	assetDenom: string,
	price: string,
	oracleAddress: string,
) => {
	const msg = {
		set_price_source: {
			denom: assetDenom,
			price_source: {
				fixed: { price: price },
			},
		},
	}

	await client.execute(deployerAddress, oracleAddress, msg, 'auto')
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
	funds: Coin[] = [],
): MsgExecuteContractEncodeObject => {
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

export const makeSendMessage = (
	sender: string,
	recipient: string,
	funds: Coin[],
): MsgSendEncodeObject => {
	return {
		typeUrl: '/cosmos.bank.v1beta1.MsgSend',
		value: {
			fromAddress: sender,
			toAddress: recipient,
			amount: funds,
		},
	}
}

export const makeDepositMessage = (
	sender: string,
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
	redbankAddress: string,
) => {
	const msg = { deposit: {} }
	const coins = [
		{
			denom: assetDenom,
			amount: amount,
		},
	]
	return await client.execute(sender, redbankAddress, msg, 'auto', undefined, coins)
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
