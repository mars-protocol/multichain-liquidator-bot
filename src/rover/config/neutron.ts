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
		neutralAssetDenom: 'factory/neutron1ke0vqqzyymlp5esr8gjwuzh94ysnpvj8er5hm7/UUSDC', // no usdc pools on testnet so we use osmo
		swapperAddress: process.env.SWAPPER_ADDRESS || 'neutron12xuseg6l3q6g6e928chmvzqus92m9tw6ajns88yg9ww5crx58djshwlqya',
		oracleAddress: process.env.ORACLE_ADDRESS || 'neutron1pev35y62g6vte0s9t67gsf6m8d60x36t7wr0p0ghjl9r3h5mwl0q4h2zwc',
		redbankAddress: process.env.REDBANK_ADDRESS || 'neutron1f8ag222s4rnytkweym7lfncrxhtee3za5uk54r5n2rjxvsl9slzq36f66d',
		accountNftAddress: process.env.ACCOUNT_NFT_ADDRESS || 'neutron1hx27cs7jjuvwq4hqgxn4av8agnspy2nwvrrq8e9f80jkeyrwrh8s8x645z',
		marsParamsAddress: process.env.MARS_PARAMS_ADDRESS || 'neutron1q66e3jv2j9r0duzwzt37fwl7h5njhr2kqs0fxmaa58sfqke80a2ss5hrz7',
		creditManagerAddress: process.env.CREDIT_MANAGER_ADDRESS || 'neutron13vyqc4efsnc357ze97ppv9h954zjasuj9d0w8es3mk9ea8sg6mvsr3xkjg',
		liquidatorMasterAddress: liquidatorMasterAddress,
		minGasTokens: 1000000,
		logResults: false,
		poolsRefreshWindow: 60000,
		maxLiquidators: process.env.MAX_LIQUIDATORS ? parseInt(process.env.MAX_LIQUIDATORS) : 1,
		stableBalanceThreshold : 5000000,
		marsEndpoint:"https://testnet-api.marsprotocol.io",

		sqsUrl: "https://sqs.osmosis.zone/"
	}
}
