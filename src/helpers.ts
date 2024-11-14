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

import { MsgSwapExactAmountIn } from 'osmojs/dist/codegen/osmosis/poolmanager/v1beta1/tx'

import {
	AminoTypes,
	GasPrice,
	MsgSendEncodeObject,
	SigningStargateClient,
	StdFee,
} from '@cosmjs/stargate'
import { camelCase } from 'lodash'
import { HdPath } from '@cosmjs/crypto'
import { SwapAmountInRoute } from 'osmojs/dist/codegen/osmosis/poolmanager/v1beta1/swap_route'
import { RouteHop } from './types/RouteHop'
import { OsmoRoute } from './types/swapper'
import { AssetInfoNative } from './query/amm/types/AstroportTypes'
import { PerpPosition, Positions } from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import BigNumber from 'bignumber.js'

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

export const camelToSnake = (camelCaseStr: string): string => {
	return (
		camelCaseStr
			// Insert an underscore before each uppercase letter
			.replace(/([a-z])([A-Z])/g, '$1_$2')
			// Convert the entire string to lowercase
			.toLowerCase()
	)
}

export const produceSigningStargateClient = async (
	rpcEndpoint: string,
	liquidator: DirectSecp256k1HdWallet,
	gasPrice: string = '0.01uosmo',
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
		broadcastPollIntervalMs: 1000,
		broadcastTimeoutMs: 300000,
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
	gasPrice: string = '0.01uosmo',
): Promise<SigningCosmWasmClient> => {
	return await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, liquidator, {
		gasPrice: GasPrice.fromString(gasPrice),
		broadcastPollIntervalMs: 1000,
		broadcastTimeoutMs: 300000,
	})
}

interface AstroportPairInfo {
	data: {
		asset_infos: AssetInfoNative[]
	}
}

export const queryAstroportLpUnderlyingTokens = async (
	lpToken: string,
): Promise<string[] | undefined> => {
	const pairAddress = lpToken.split('/')[1]

	// Build the url
	const encodedMsg = Buffer.from(JSON.stringify({ pair: {} })).toString('base64')
	const url = `${process.env.LCD_ENDPOINT}/cosmwasm/wasm/v1/contract/${pairAddress}/smart/${encodedMsg}`

	// Fetch pair info
	const response = await fetch(url)
	const pairInfo: AstroportPairInfo = await response.json()

	return pairInfo.data.asset_infos.map((assetInfo) => assetInfo.native_token.denom)
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
	fee?: StdFee,
): Promise<string[]> => {
	const seededAddresses: string[] = []
	const sendTokenMsgs: EncodeObject[] = []

	console.log(`seeding children for ${sender}`)
	accounts.forEach((account) => {
		if (account.address === sender) return

		const addressToSeed = account.address
		console.log(`seeding ${addressToSeed}`)

		// todo - optimise this into one msg
		const gasMsg = {
			typeUrl: '/cosmos.bank.v1beta1.MsgSend',
			value: {
				fromAddress: sender,
				toAddress: addressToSeed,
				amount: [{ denom: 'uosmo', amount: '1000000' }],
			},
		}

		sendTokenMsgs.push(gasMsg)
		sendTokenMsgs.push({
			typeUrl: '/cosmos.bank.v1beta1.MsgSend',
			value: {
				fromAddress: sender,
				toAddress: addressToSeed,
				amount: coins,
			},
		})

		seededAddresses.push(addressToSeed)
	})

	await client.signAndBroadcast(sender, sendTokenMsgs, fee ? fee : 'auto')

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
	redbankAddress: string,
) => {
	const msg = {
		borrow: {
			denom: assetDenom,
			amount: amount,
		},
	}

	return await client.execute(sender, redbankAddress, msg, 'auto')
}

export const produceExecuteContractMessage = (
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

export const produceSendMessage = (
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

export const produceDepositMessage = (
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

export const produceBorrowMessage = (
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

export const produceWithdrawMessage = (
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
	return produceExecuteContractMessage(sender, redBankContractAddress, msg, [])
}

export const calculateTotalPerpPnl = (perpPositions: PerpPosition[]): BigNumber => {
	return perpPositions.reduce((acc, position) => {
		return acc.plus(position.unrealized_pnl.pnl.toString())
	}, BigNumber(0))
}

// Calculate the state of the position post perp closure.
// This simulates what would happen in the contracts when liquidation, as all positions are
// closed and pnl is realised.
// This is required to understand the position state during liquidation
export const calculatePositionStateAfterPerpClosure = (
	positions: Positions,
	baseDenom: string,
): Positions => {
	const totalPerpPnl: BigNumber = calculateTotalPerpPnl(positions.perps)
	const baseDenomDeposits = positions.deposits.find((deposit) => deposit.denom === baseDenom)
	const baseDenomLends = positions.lends.find((lend) => lend.denom === baseDenom)
	const baseDenomDebts = positions.debts.find((debt) => debt.denom === baseDenom)

	const depositAmount = baseDenomDeposits ? BigNumber(baseDenomDeposits.amount) : BigNumber(0)
	const lentAmount = baseDenomLends ? BigNumber(baseDenomLends.amount) : BigNumber(0)
	const debtAmount = baseDenomDebts ? BigNumber(baseDenomDebts.amount) : BigNumber(0)

	if (totalPerpPnl.isNegative()) {
		let remainingDebt = totalPerpPnl.abs()

		// First we deduct from deposits
		if (baseDenomDeposits) {
			if (depositAmount.gt(remainingDebt)) {
				baseDenomDeposits.amount = depositAmount.minus(remainingDebt).toString()
				remainingDebt = BigNumber(0)
			} else {
				remainingDebt = remainingDebt.minus(depositAmount)
				baseDenomDeposits.amount = '0'
			}
		}

		// If we have remaining, deduct from lends
		if (baseDenomLends) {
			if (lentAmount.gt(remainingDebt)) {
				baseDenomLends.amount = lentAmount.minus(remainingDebt).toString()
				remainingDebt = BigNumber(0)
			} else {
				remainingDebt = remainingDebt.minus(lentAmount)
				baseDenomLends.amount = '0'
			}
		}

		// if we still have debt, we need to increment it
		if (baseDenomDebts) {
			baseDenomDebts.amount = debtAmount.plus(remainingDebt).toString()
		} else {
			positions.debts.push({
				amount: remainingDebt.toString(),
				denom: baseDenom,
				shares: remainingDebt.toString(),
			})
		}
	} else {
		// If there are deposits, add the remaining to the existing deposit, otherwise create a new deposit
		if (baseDenomDeposits) {
			const newDepositsAmount = depositAmount.plus(totalPerpPnl)
			baseDenomDeposits.amount = newDepositsAmount.abs().toString()
		} else {
			positions.deposits.push({
				amount: totalPerpPnl.abs().toString(),
				denom: baseDenom,
				shares: totalPerpPnl.abs().toString(), // do we care about shares?
			})
		}
	}

	return positions
}

interface MsgSwapEncodeObject {
	typeUrl: string
	value: MsgSwapExactAmountIn
}

export const produceRepayMessage = (
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

export const produceSwapMessage = (
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

export const createOsmoRoute = (route: RouteHop[]): OsmoRoute => {
	const osmoRoute: OsmoRoute = {
		swaps: route.map((hop) => {
			return {
				pool_id: hop.poolId.toNumber(),
				to: hop.tokenOutDenom,
			}
		}),
	}

	return osmoRoute
}

export const queryHealth = async (
	client: CosmWasmClient,
	address: string,
	redbankAddress: string,
) => {
	const msg = { user_position: { user: address } }
	return await client.queryContractSmart(redbankAddress, msg)
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
