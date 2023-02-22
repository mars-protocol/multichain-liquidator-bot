import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { produceReadOnlyCosmWasmClient, produceSigningStargateClient } from '../helpers.js'
import { getSecretManager } from '../secretManager.js'
import { Network } from '../types/network.js'
import { getConfig } from './config/osmosis.js'
import { Executor } from './executor.js'

export const main = async () => {
	// If you wish to use a secret manager, construct it here
	const sm = getSecretManager()

	const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(await sm.getSeedPhrase(), {
		prefix: process.env.PREFIX!,
	})

	const liquidatorMasterAddress = (await liquidator.getAccounts())[0].address

	const liquidatorAddress = (await liquidator.getAccounts())[Number(process.env.ACCOUNT_INDEX!)]
		.address

	// produce clients
	const queryClient = await produceReadOnlyCosmWasmClient(process.env.RPC_ENDPOINT!)
	const client = await produceSigningStargateClient(process.env.RPC_ENDPOINT!, liquidator)

	await new Executor(
		getConfig(liquidatorMasterAddress, liquidatorAddress, Network.TESTNET),
		client,
		queryClient,
	).start()
}

main().catch((e) => {
	console.log(e)
	process.exit(1)
})
