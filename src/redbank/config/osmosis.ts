import { mapValues } from 'lodash'
import { Network } from '../../types/network'
import { RedbankExecutorConfig } from '../RedbankExecutor'

export const getConfig = (
	liquidatorMasterAddress: string,
	network: Network,
): RedbankExecutorConfig => {
	return network === Network.MAINNET
		? {
				safetyMargin: 0.05,
				chainName: 'osmosis',
				productName: 'redbank',
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
				lcdEndpoint: process.env.LCD_ENDPOINT!, // use env vars in order to be able to quickly change
				gasDenom: 'uosmo',
				liquidatorMasterAddress: liquidatorMasterAddress,
				logResults: false, // enable for debugging
				neutralAssetDenom: 'ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4',
				poolsRefreshWindow: 60000,
				liquidationProfitMarginPercent: 0.01,
				marsEndpoint: process.env.MARS_API_ENDPOINT ? process.env.MARS_API_ENDPOINT : 'https://api.marsprotocol.io',
				sqsUrl: process.env.SQS_URL!,
		  }
		: {
				chainName: 'osmosis',
				productName: 'redbank',
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
				safetyMargin: 0.05,
				lcdEndpoint: process.env.LCD_ENDPOINT!,
				gasDenom: 'uosmo',
				liquidatorMasterAddress: liquidatorMasterAddress,
				logResults: false, // enable for debugging
				neutralAssetDenom: 'uosmo', // no usdc pools on testnet
				poolsRefreshWindow: 60000,
				marsEndpoint: process.env.MARS_API_ENDPOINT ? process.env.MARS_API_ENDPOINT : 'https://testnet-api.marsprotocol.io',
				liquidationProfitMarginPercent: 0.01,
				sqsUrl: process.env.SQS_URL!,
		  }
}
