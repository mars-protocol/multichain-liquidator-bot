import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { HdPath } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import { produceReadOnlyCosmWasmClient, produceSigningStargateClient } from './helpers.js'
import { RedbankExecutor, RedbankExecutorConfig } from './redbank/RedbankExecutor'
import { getConfig as getRoverConfig } from './rover/config/osmosis'
import { RoverExecutor } from './rover/RoverExecutor'
import { getSecretManager } from './secretManager'
import { Network } from './types/network'
import { PoolDataProviderInterface } from './query/amm/PoolDataProviderInterface.js'
import { OsmosisPoolProvider } from './query/amm/OsmosisPoolProvider.js'
import { AstroportPoolProvider } from './query/amm/AstroportPoolProvider.js'
import { ExchangeInterface } from './execute/ExchangeInterface.js'
import { Osmosis } from './execute/Osmosis.js'
import { getConfig } from './redbank/config/getConfig.js'
import { BaseExecutorConfig } from './BaseExecutor.js'
import { AstroportCW } from './execute/AstroportCW.js'

const REDBANK = 'Redbank'
const ROVER = 'Rover'

export const main = async () => {

	// Define if we are launching a rover executor or a redbank executor
	const executorType = process.env.EXECUTOR_TYPE!

	const sm = getSecretManager()

	// produce paths for the number of addresses we want under our seed
	const addressCount = process.env.MAX_LIQUIDATORS || 1
	const chainName = process.env.CHAIN_NAME!
	const prefix = process.env.CHAIN_PREFIX!
	const hdPaths: HdPath[] = []

	while (hdPaths.length <= Number(addressCount)) {
		hdPaths.push(makeCosmoshubPath(hdPaths.length))
	}

	const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(await sm.getSeedPhrase(), {
		prefix ,
		hdPaths,
	})
	const liquidatorMasterAddress = (await liquidator.getAccounts())[0].address

	// produce clients
	const queryClient = await produceReadOnlyCosmWasmClient(process.env.RPC_ENDPOINT!)
	const client = await produceSigningStargateClient(process.env.RPC_ENDPOINT!, liquidator)
	const networkEnv = process.env.NETWORK || "LOCALNET"
	const network  = networkEnv === "MAINNET" ? Network.MAINNET : networkEnv === "TESTNET" ? Network.TESTNET : Network.LOCALNET

	const redbankConfig = getConfig(liquidatorMasterAddress, network, chainName)

	const exchangeInterface = chainName === "osmosis" ? new Osmosis() : new AstroportCW(prefix, redbankConfig.astroportRouter!)
	// Produce network
	const poolProvider = getPoolProvider(chainName, redbankConfig)

	switch (executorType) {
		case REDBANK:
			await launchRedbank(client, queryClient, redbankConfig, poolProvider, exchangeInterface)
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

const getPoolProvider = (chainName: string, config: BaseExecutorConfig) : PoolDataProviderInterface => {
	switch (chainName) {
		case "osmosis":
			return new OsmosisPoolProvider(process.env.LCD_ENDPOINT!, process.env.API_KEY!)
		case "neutron":

			return new AstroportPoolProvider(config.astroportFactory!, process.env.HIVE_ENDPOINT!)
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
	redbankConfig : RedbankExecutorConfig,
	poolProvider : PoolDataProviderInterface,
	exchangeInterface : ExchangeInterface

) => {
	await new RedbankExecutor(
		redbankConfig,
		client,
		wasmClient,
		poolProvider,
		exchangeInterface
	).start()
}

main().catch((e) => {
	console.log(e)
	process.exit(1)
})
