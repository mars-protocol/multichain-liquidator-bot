import { mapValues } from 'lodash'
import { Network } from '../../types/network'
import { RoverExecutorConfig } from '../RoverExecutor'

export const getConfig = (
	liquidatorMasterAddress: string,
	network: Network,
): RoverExecutorConfig => {
	if (network === Network.MAINNET) {
		return {
			gasDenom: 'uosmo',
			chainName: 'osmosis',
			productName: 'creditmanager',
			contracts: mapValues({
				addressProvider: 'osmo1g677w7mfvn78eeudzwylxzlyz69fsgumqrscj6tekhdvs8fye3asufmvxr',
				redbank: 'osmo1c3ljch9dfw5kf52nfwpxd2zmj2ese7agnx0p9tenkrryasrle5sqf3ftpg',
				incentives: 'osmo1nkahswfr8shg8rlxqwup0vgahp0dk4x8w6tkv3rra8rratnut36sk22vrm',
				oracle: 'osmo1mhznfr60vjdp2gejhyv2gax9nvyyzhd3z0qcwseyetkfustjauzqycsy2g',
				rewardsCollector: 'osmo1urvqe5mw00ws25yqdd4c4hlh8kdyf567mpcml7cdve9w08z0ydcqvsrgdy',
				swapper: 'osmo1wee0z8c7tcawyl647eapqs4a88q8jpa7ddy6nn2nrs7t47p2zhxswetwla',
				zapper: 'osmo17qwvc70pzc9mudr8t02t3pl74hhqsgwnskl734p4hug3s8mkerdqzduf7c',
				creditManager: 'osmo1f2m24wktq0sw3c0lexlg7fv4kngwyttvzws3a3r3al9ld2s2pvds87jqvf',
				accountNft: 'osmo1450hrg6dv2l58c0rvdwx8ec2a0r6dd50hn4frk370tpvqjhy8khqw7sw09',
				params: 'osmo1nlmdxt9ctql2jr47qd4fpgzg84cjswxyw6q99u4y4u4q6c2f5ksq7ysent',
				health: 'osmo1pdc49qlyhpkzx4j24uuw97kk6hv7e9xvrdjlww8qj6al53gmu49sge4g79',
			}),
			lcdEndpoint: process.env.LCD_ENDPOINT!,
			neutralAssetDenom: 'ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4',
			//neutralAssetDenom: 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858',
			liquidatorMasterAddress: liquidatorMasterAddress,
			minGasTokens: 1000000,
			logResults: false,
			poolsRefreshWindow: 60000,
			maxLiquidators: process.env.MAX_LIQUIDATORS ? parseInt(process.env.MAX_LIQUIDATORS) : 10,
			stableBalanceThreshold: 5000000,
			// marsEndpoint: "http://127.0.0.1:3000",
			marsEndpoint: 'https://api.marsprotocol.io',
			sqsUrl: 'https://sqs.osmosis.zone/',
		}
	}

	// Not mainnet
	return {
		gasDenom: 'uosmo',
		chainName: 'osmosis',
		productName: 'creditmanager',
		contracts: mapValues({
			addressProvider: 'osmo1g677w7mfvn78eeudzwylxzlyz69fsgumqrscj6tekhdvs8fye3asufmvxr',
			redbank: 'osmo1c3ljch9dfw5kf52nfwpxd2zmj2ese7agnx0p9tenkrryasrle5sqf3ftpg',
			incentives: 'osmo1nkahswfr8shg8rlxqwup0vgahp0dk4x8w6tkv3rra8rratnut36sk22vrm',
			oracle: 'osmo1mhznfr60vjdp2gejhyv2gax9nvyyzhd3z0qcwseyetkfustjauzqycsy2g',
			rewardsCollector: 'osmo1urvqe5mw00ws25yqdd4c4hlh8kdyf567mpcml7cdve9w08z0ydcqvsrgdy',
			swapper: 'osmo1wee0z8c7tcawyl647eapqs4a88q8jpa7ddy6nn2nrs7t47p2zhxswetwla',
			zapper: 'osmo17qwvc70pzc9mudr8t02t3pl74hhqsgwnskl734p4hug3s8mkerdqzduf7c',
			creditManager: 'osmo1f2m24wktq0sw3c0lexlg7fv4kngwyttvzws3a3r3al9ld2s2pvds87jqvf',
			accountNft: 'osmo1450hrg6dv2l58c0rvdwx8ec2a0r6dd50hn4frk370tpvqjhy8khqw7sw09',
			params: 'osmo1aye5qcer5n52crrkaf35jprsad2807q6kg3eeeu7k79h4slxfausfqhc9y',
			health: 'osmo1kqzkuyh23chjwemve7p9t7sl63v0sxtjh84e95w4fdz3htg8gmgspua7q4',
		}),
		lcdEndpoint: process.env.LCD_ENDPOINT!,
		neutralAssetDenom: 'uosmo', // no usdc pools on testnet so we use osmo
		liquidatorMasterAddress: liquidatorMasterAddress,
		minGasTokens: 10000000,
		logResults: false,
		poolsRefreshWindow: 60000,
		maxLiquidators: 100,
		stableBalanceThreshold: 5000000,
		sqsUrl: 'https://sqs.osmosis.zone/',
	}
}
