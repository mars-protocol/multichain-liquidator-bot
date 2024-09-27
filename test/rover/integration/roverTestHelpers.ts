import { SigningStargateClient } from '@cosmjs/stargate'
import { getAddress, getWallet, produceSigningStargateClient, Seed } from '../../../src/helpers.js'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { MarsCreditManagerClient } from 'marsjs-types/mars-credit-manager/MarsCreditManager.client'
import { MarsAccountNftQueryClient } from 'marsjs-types/mars-account-nft/MarsAccountNft.client'
import {
	Action,
	Coin,
} from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import { difference } from 'lodash'

export enum PositionCollectionType {
	CASCADE,
	FIXED,
}

export interface RoverHelperConfig {
	seeds: Seed[]
	prefix: string
	rpcEndpoint: string
	creditManagerAddress: string
	accountNft: string
	redbankAddress: string
	liquidatorAddress: string
	oracleAddress: string
	deployerAddress: string
	userAddress: string
	baseDenom: string
}

export const createCreditAccount = async (
	userAddress: string,
	nft: MarsAccountNftQueryClient,
	exec: MarsCreditManagerClient,
): Promise<string> => {
	const before = await nft.tokens({ owner: userAddress })
	await exec.createCreditAccount(
		'default'
	)
	const after = await nft.tokens({ owner: userAddress })
	const diff = difference(after.tokens, before.tokens)

	const accountId = diff[0]

	if (accountId === undefined || accountId === null) {
		throw new Error('Failed to create account Id')
	}

	return accountId.toString()
}

export const generateNewAddress = async (prefix: string, rpcEndpoint: string) => {
	const { mnemonic } = await DirectSecp256k1HdWallet.generate(24)
	const wallet = await getWallet(mnemonic, prefix)
	const client: SigningStargateClient = await produceSigningStargateClient(rpcEndpoint, wallet)
	const address = await getAddress(wallet)
	return { client, address }
}

export const updateCreditAccount = async (
	actions: Action[],
	accountId: string,
	exec: MarsCreditManagerClient,
	funds?: Coin[],
) => {
	return await exec.updateCreditAccount({ actions, accountId }, 'auto', undefined, funds)
}
