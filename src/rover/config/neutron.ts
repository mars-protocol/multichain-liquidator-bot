import { Network } from '../../types/network'
import { RoverExecutorConfig } from '../RoverExecutor'

export const getConfig = (
	liquidatorMasterAddress: string,
	network: Network,
): RoverExecutorConfig => {
	if (network === Network.MAINNET) {
		return {
			gasDenom: 'untrn',
			chainName: "neutron",
			hiveEndpoint: process.env.HIVE_ENDPOINT!,
			lcdEndpoint: process.env.LCD_ENDPOINT!,
			neutralAssetDenom: 'ibc/B559A80D62249C8AA07A380E2A2BEA6E5CA9A6F079C912C3A9E9B494105E4F81',
			//neutralAssetDenom: 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858',
			swapperAddress: process.env.SWAPPER_ADDRESS || 'neutron1udr9fc3kd743dezrj38v2ac74pxxr6qsx4xt4nfpcfczgw52rvyqyjp5au',
			oracleAddress: process.env.ORACLE_ADDRESS || 'neutron1dwp6m7pdrz6rnhdyrx5ha0acsduydqcpzkylvfgspsz60pj2agxqaqrr7g',
			redbankAddress: process.env.REDBANK_ADDRESS || 'neutron1n97wnm7q6d2hrcna3rqlnyqw2we6k0l8uqvmyqq6gsml92epdu7quugyph',
			accountNftAddress: process.env.ACCOUNT_NFT_ADDRESS || 'neutron184kvu96rqtetmunkkmhu5hru8yaqg7qfhd8ldu5avjnamdqu69squrh3f5',
			marsParamsAddress: process.env.MARS_PARAMS_ADDRESS || 'neutron1x4rgd7ry23v2n49y7xdzje0743c5tgrnqrqsvwyya2h6m48tz4jqqex06x',
			creditManagerAddress: process.env.CREDIT_MANAGER_ADDRESS || 'neutron1qdzn3l4kn7gsjna2tfpg3g3mwd6kunx4p50lfya59k02846xas6qslgs3r',
			liquidatorMasterAddress: liquidatorMasterAddress,
			minGasTokens: 1000000,
			logResults: false,
			poolsRefreshWindow: 60000,
			maxLiquidators: process.env.MAX_LIQUIDATORS ? parseInt(process.env.MAX_LIQUIDATORS) : 10,
			stableBalanceThreshold: 5000000,
			// marsEndpoint: "http://127.0.0.1:3000",
			marsEndpoint:"https://api.marsprotocol.io",
			sqsUrl: "https://sqs.osmosis.zone/"
		}
	}

	// Not mainnet
	return {
		gasDenom: 'untrn',
		chainName : "neutron",
		hiveEndpoint: process.env.HIVE_ENDPOINT!,
		lcdEndpoint: process.env.LCD_ENDPOINT!,
		neutralAssetDenom: 'untrn', // no usdc pools on testnet so we use osmo
		swapperAddress: process.env.SWAPPER_ADDRESS || 'osmo17c4retwuyxjxzv9f2q9r0272s8smktpzhjetssttxxdavarjtujsjqafa2',
		oracleAddress: process.env.ORACLE_ADDRESS || 'osmo1dh8f3rhg4eruc9w7c9d5e06eupqqrth7v32ladwkyphvnn66muzqxcfe60',
		redbankAddress: process.env.REDBANK_ADDRESS || 'osmo1pvrlpmdv3ee6lgmxd37n29gtdahy4tec7c5nyer9aphvfr526z6sff9zdg',
		accountNftAddress: process.env.ACCOUNT_NFT_ADDRESS || 'osmo1j0m37hqpaeh79cjrdna4sep6yfyu278rrm4qta6s4hjq6fv3njxqsvhcex',
		marsParamsAddress: process.env.MARS_PARAMS_ADDRESS || 'osmo1dpwu03xc45vpqur6ry69xjhltq4v0snrhaukcp4fvhucx0wypzhs978lnp',
		creditManagerAddress: process.env.CREDIT_MANAGER_ADDRESS || 'osmo12wd0rwuvu7wwujztkww5c7sg4fw4e6t235jyftwy5ydc48uxd24q4s9why',
		liquidatorMasterAddress: liquidatorMasterAddress,
		minGasTokens: 10000000,
		logResults: false,
		poolsRefreshWindow: 60000,
		maxLiquidators: 100,
		stableBalanceThreshold : 5000000,
		sqsUrl: "https://sqs.osmosis.zone/"
	}
}
