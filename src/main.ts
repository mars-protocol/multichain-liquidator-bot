import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { HdPath } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import { produceReadOnlyCosmWasmClient, produceSigningStargateClient } from './helpers.js'
import { RedbankExecutor, RedbankExecutorConfig } from './redbank/RedbankExecutor.js'
import { RoverExecutor, RoverExecutorConfig } from './rover/RoverExecutor.js'
import { getSecretManager } from './secretManager.js'
import { Network } from './types/network.js'
import { Exchange } from './exchange/ExchangeInterface.js'
import { Osmosis } from './exchange/Osmosis.js'
import { getRedbankConfig } from './redbank/config/getConfig.js'
import { getConfig as getRoverConfig } from './rover/config/getConfig.js'
import { AstroportCW } from './exchange/Astroport.js'
import { AstroportRouteRequester } from './query/routing/AstroportRouteRequester.js'
import { OsmosisRouteRequester } from './query/routing/OsmosisRouteRequester.js'
import { RouteRequester } from './query/routing/RouteRequesterInterface.js'

const REDBANK = 'Redbank'
const ROVER = 'Rover'

export const main = async () => {
	// Define if we are launching a rover executor or a redbank executor
	const executorType = process.env.EXECUTOR_TYPE!

	// get config

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
		prefix,
		hdPaths,
	})
	const liquidatorMasterAddress = (await liquidator.getAccounts())[0].address

	// Produce config
	const network =
		process.env.NETWORK === 'MAINNET'
			? Network.MAINNET
			: process.env.NETWORK === 'TESTNET'
			? Network.TESTNET
			: Network.LOCALNET
	const redbankConfig = getRedbankConfig(liquidatorMasterAddress, network, chainName)
	const roverConfig = getRoverConfig(liquidatorMasterAddress, network, chainName)

	// Produce clients
	const queryClient = await produceReadOnlyCosmWasmClient(process.env.RPC_ENDPOINT!)
	const client = await produceSigningStargateClient(process.env.RPC_ENDPOINT!, liquidator)

	const exchangeInterface =
		chainName === 'osmosis'
			? new Osmosis()
			: new AstroportCW(prefix, redbankConfig.astroportRouter!)
	const routeRequester =
		chainName === 'neutron'
			? new AstroportRouteRequester(process.env.ASTROPORT_API_URL!)
			: new OsmosisRouteRequester(process.env.API_URL!)

	switch (executorType) {
		case REDBANK:
			await launchRedbank(client, queryClient, redbankConfig, exchangeInterface, routeRequester)
			return
		case ROVER:
			await launchRover(client, queryClient, roverConfig, liquidator, routeRequester)
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
	roverConfig: RoverExecutorConfig,
	liquidatorWallet: DirectSecp256k1HdWallet,
	routeRequester: RouteRequester,
) => {
	await new RoverExecutor(roverConfig, client, wasmClient, liquidatorWallet, routeRequester).start()
}

const launchRedbank = async (
	client: SigningStargateClient,
	wasmClient: CosmWasmClient,
	redbankConfig: RedbankExecutorConfig,
	exchangeInterface: Exchange,
	routeRequester: RouteRequester,
) => {
	await new RedbankExecutor(
		redbankConfig,
		client,
		wasmClient,
		exchangeInterface,
		routeRequester,
	).start()
}

main().catch((e) => {
	console.log(e)
	process.exit(1)
})
