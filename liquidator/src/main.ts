import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { HdPath } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import { produceReadOnlyCosmWasmClient, produceSigningStargateClient } from './helpers.js'
import { getConfig as getRedbankConfig } from './redbank/config/osmosis.js'
import { RedbankExecutor } from './redbank/RedbankExecutor'
import { getConfig as getRoverConfig } from './rover/config/osmosis'
import { RoverExecutor } from './rover/RoverExecutor'
import { getSecretManager } from './secretManager'
import { Network } from './types/network'

const REDBANK = 'Redbank'
const ROVER = 'Rover'

export const main = async () => {

	// Define if we are launching a rover executor or a redbank executor
	const executorType = process.env.EXECUTOR_TYPE!

	const sm = getSecretManager()

	// produce paths for the number of addresses we want under our seed
	const addressCount = process.env.MAX_LIQUIDATORS || 1
	const paths: HdPath[] = []

	while (paths.length < addressCount) {
		paths.push(makeCosmoshubPath(paths.length))
	}

	const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(await sm.getSeedPhrase(), {
		prefix: process.env.PREFIX!,
		hdPaths: paths,
	})
	const liquidatorMasterAddress = (await liquidator.getAccounts())[0].address

	// produce clients
	const queryClient = await produceReadOnlyCosmWasmClient(process.env.RPC_ENDPOINT!)
	const client = await produceSigningStargateClient(process.env.RPC_ENDPOINT!, liquidator)

	// Produce network
	const networkEnv = process.env.NETWORK || "LOCALNET"
	const network  = networkEnv === "MAINNET" ? Network.MAINNET : networkEnv === "TESTNET" ? Network.TESTNET : Network.LOCALNET
	switch (executorType) {
		case REDBANK:
			await launchRedbank(client, queryClient, network, liquidatorMasterAddress)
			return
		case ROVER:
			await launchRover(client, queryClient, network, liquidatorMasterAddress, liquidator)
			return
		default:
			throw new Error(
				`Invalid executor type. Executor type must be either ${REDBANK} or ${ROVER}, recieved ${executorType}`,
			)
	}
}

const launchRover = async (
	client: SigningStargateClient,
	wasmClient: CosmWasmClient,
	network: Network,
	liquidatorMasterAddress: string,
	liquidatorWallet: DirectSecp256k1HdWallet,
) => {
	await new RoverExecutor(
		getRoverConfig(liquidatorMasterAddress, network),
		client,
		wasmClient,
		liquidatorWallet
	).start()
}

const launchRedbank = async (
	client: SigningStargateClient,
	wasmClient: CosmWasmClient,
	network: Network,
	liquidatorAddress: string,
) => {
	await new RedbankExecutor(
		getRedbankConfig(liquidatorAddress, network),
		client,
		wasmClient,
	).start()
}

main().catch((e) => {
	console.log(e)
	process.exit(1)
})
