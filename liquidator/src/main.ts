import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { SigningStargateClient, makeCosmoshubPath } from '@cosmjs/stargate'
import { produceReadOnlyCosmWasmClient, produceSigningStargateClient } from './helpers.js'
import { RedbankExecutor, RedbankExecutorConfig } from './redbank/RedbankExecutor'
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
import { HdPath } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { AstroportRouteRequester } from './query/amm/AstroportRouteRequester.js'

const REDBANK = 'Redbank'
const ROVER = 'Rover'

export const main = async () => {
	console.log("STARTED")
	// Define if we are launching a rover executor or a redbank executor
	const executorType = process.env.EXECUTOR_TYPE!

	const sm = getSecretManager()

	// produce paths for the number of addresses we want under our seed
	const addressCount = process.env.MAX_LIQUIDATORS || 1
	const chainName = process.env.CHAIN_NAME!
	const prefix = process.env.CHAIN_PREFIX!
	const hdPaths: HdPath[] = []

	while (hdPaths.length < Number(addressCount)) {
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
	// todo add sqs server
	const routeRequester = chainName === "neutron" ? new AstroportRouteRequester() : undefined
	
	// Produce network

	const poolProvider = getPoolProvider(chainName, redbankConfig)

	switch (executorType) {
		case REDBANK:
			await launchRedbank(
				client,
				queryClient,
				redbankConfig,
				poolProvider,
				exchangeInterface,
				routeRequester
			)
			return
		case ROVER:
			throw new Error('Rover not supported by MarsV1')
		default:
			throw new Error(
				`Invalid executor type. Executor type must be either ${REDBANK} or ${ROVER}, recieved ${executorType}`,
			)
	}
}

const getPoolProvider = (chainName: string, config: BaseExecutorConfig) : PoolDataProviderInterface => {
	switch (chainName) {
		case "osmosis":
			return new OsmosisPoolProvider(process.env.LCD_ENDPOINT!)
		case "neutron":

			return new AstroportPoolProvider(
				config.astroportFactory!,
				process.env.HIVE_ENDPOINT!,
				process.env.LCD_ENDPOINT!)
		default:
			throw new Error(`Invalid chain name. Chain name must be either osmosis or neutron, recieved ${chainName}`)
	}
}

const launchRedbank = async (
	client: SigningStargateClient,
	wasmClient: CosmWasmClient,
	redbankConfig : RedbankExecutorConfig,
	poolProvider : PoolDataProviderInterface,
	exchangeInterface : ExchangeInterface,
	apiRequester?: any,

) => {
	await new RedbankExecutor(
		redbankConfig,
		client,
		wasmClient,
		poolProvider,
		exchangeInterface,
		apiRequester,
		
	).start()
}

main().catch((e) => {
	console.log(e)
	process.exit(1)
})
