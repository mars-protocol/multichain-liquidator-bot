import { HdPath } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import { produceSigningStargateClient } from '../../helpers.js'
import { RedbankExecutor, RedbankExecutorConfig } from '../../redbank/RedbankExecutor.js'
import { getSecretManager } from '../../secretManager.js'
import { Network } from '../../types/network.js'
import { Osmosis } from '../../exchange/Osmosis.js'
import { AstroportCW } from '../../exchange/Astroport.js'
import { getRedbankConfig } from '../../redbank/config/getConfig.js'
import { SkipRouteRequester } from '../../query/routing/skip/SkipRouteRequester.js'
import { OsmosisRouteRequester } from '../../query/routing/OsmosisRouteRequester.js'
import { RouteRequester } from '../../query/routing/RouteRequesterInterface.js'
import { ChainQuery } from '../../query/chainQuery.js'
import { Exchange } from '../../exchange/ExchangeInterface.js'

export const buildRedbankExecutor = async (): Promise<RedbankExecutor> => {
	const sm = getSecretManager()
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

	const network =
		process.env.NETWORK === 'MAINNET'
			? Network.MAINNET
			: process.env.NETWORK === 'TESTNET'
			? Network.TESTNET
			: Network.LOCALNET

	const redbankConfig = getRedbankConfig(
		liquidatorMasterAddress,
		network,
		chainName,
	) as RedbankExecutorConfig

	const chainQuery = new ChainQuery(
		process.env.LCD_ENDPOINT!,
		process.env.APIKEY!,
		redbankConfig.contracts,
	)
	const signingClient: SigningStargateClient = await produceSigningStargateClient(
		process.env.RPC_ENDPOINT!,
		liquidator,
	)

	const exchangeInterface: Exchange =
		chainName === 'osmosis'
			? new Osmosis()
			: new AstroportCW(prefix, redbankConfig.astroportRouter!)

	const routeRequester: RouteRequester =
		chainName === 'neutron'
			? new SkipRouteRequester('https://api.skip.build')
			: new OsmosisRouteRequester(process.env.SQS_URL!)

	return new RedbankExecutor(
		redbankConfig,
		signingClient,
		chainQuery,
		exchangeInterface,
		routeRequester,
	)
}
