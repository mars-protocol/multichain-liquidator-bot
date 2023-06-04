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
import { PoolDataProviderInterface } from './query/amm/PoolDataProviderInterface.js'
import { OsmosisPoolProvider } from './query/amm/OsmosisPoolProvider.js'
import { AstroportPoolProvider } from './query/amm/AstroportPoolProvider.js'
import { Osmosis } from './execute/Osmosis.js'
import { ExchangeInterface } from './execute/ExchangeInterface.js'

const REDBANK = 'Redbank'
const ROVER = 'Rover'

export const main = async () => {

	// Define if we are launching a rover executor or a redbank executor
	const executorType = process.env.EXECUTOR_TYPE!

	const sm = getSecretManager()

	// produce paths for the number of addresses we want under our seed
	const addressCount = process.env.MAX_LIQUIDATORS || 1
	const paths: HdPath[] = []

	while (paths.length < Number(addressCount)) {
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

	const poolProvider = getPoolProvider(process.env.CHAIN_NAME!)

	switch (executorType) {
		case REDBANK:
			await launchRedbank(client, queryClient, network, liquidatorMasterAddress, poolProvider)
			return
		case ROVER:
			await launchRover(client, queryClient, network, liquidatorMasterAddress, liquidator, poolProvider)
			return
		default:
			throw new Error(
				`Invalid executor type. Executor type must be either ${REDBANK} or ${ROVER}, recieved ${executorType}`,
			)
	}
}

const getPoolProvider = (chainName: string) : PoolDataProviderInterface => {
	switch (chainName) {
		case "osmosis":
			return new OsmosisPoolProvider(process.env.LCD_ENDPOINT!)
		case "neutron":
			return new AstroportPoolProvider(process.env.ASTROPORT_FACTORY_CONTRACT!, process.env.GRAPHQL_ENDPOINT!)
		default:
			throw new Error(`Invalid chain name. Chain name must be either osmosis or neutron, recieved ${chainName}`)
	}
}

const launchRover = async (
	client: SigningStargateClient,
	wasmClient: CosmWasmClient,
	network: Network,
	liquidatorMasterAddress: string,
	liquidatorWallet: DirectSecp256k1HdWallet,
	poolProvider : PoolDataProviderInterface

) => {
	await new RoverExecutor(
		getRoverConfig(liquidatorMasterAddress, network),
		client,
		wasmClient,
		liquidatorWallet,
		poolProvider
	).start()
}

const launchRedbank = async (
	client: SigningStargateClient,
	wasmClient: CosmWasmClient,
	network: Network,
	liquidatorAddress: string,
	poolProvider : PoolDataProviderInterface,
	exchangeInterface : ExchangeInterface

) => {
	await new RedbankExecutor(
		getRedbankConfig(liquidatorAddress, network),
		client,
		wasmClient,
		poolProvider,

	).start()
}

main().catch((e) => {
	console.log(e)
	process.exit(1)
})
