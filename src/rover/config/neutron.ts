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

	// redBank: 'neutron14zjmuel0t8q9rqezp2vtj706ckl8eqtrkc2cjexsssh8vgpuzxdqjuqydr',
    // incentives: 'neutron1lkk4e6y9pjkev9patc3t6lwey7032f3eqh577v8dvk9ws8awsv4sk0t45a',
    // oracle: 'neutron1hkggq76w07x53z9hu2hhq8kn8n9e77vc0nztrl2h3sn4cgz9v0ps577a53',
    // params: 'neutron15tdtcemvkj3g7vuuz83twcekg86j3f58jet9lv08u0j7j8ztymsqd47l9z',
    // creditManager: 'neutron1gtqq647nrkgwxr3anrdty6fqfvfqav9kkwuu7el0gw754yx42dgs0s92zx',
    // accountNft: 'neutron128pgfadzvmck5qccgpcjwew4lgsn5e4ha82cu7rrnyg45rrpxessuqdnmt',
    // perps: 'neutron1mmjd5gz5943s4nnd5929s5hxfzw6lv3jrp3zthkxkanve70qax4qwyyzt5',
    // pyth: 'neutron15ldst8t80982akgr8w8ekcytejzkmfpgdkeq4xgtge48qs7435jqp87u3t',

	// Not mainnet
	return {
		gasDenom: 'untrn',
		chainName : "neutron",
		hiveEndpoint: process.env.HIVE_ENDPOINT!,
		lcdEndpoint: process.env.LCD_ENDPOINT!,
		neutralAssetDenom: 'factory/neutron1ke0vqqzyymlp5esr8gjwuzh94ysnpvj8er5hm7/USDC', // no usdc pools on testnet so we use osmo
		swapperAddress: process.env.SWAPPER_ADDRESS || 'osmo17c4retwuyxjxzv9f2q9r0272s8smktpzhjetssttxxdavarjtujsjqafa2',
		oracleAddress: process.env.ORACLE_ADDRESS || 'neutron1hkggq76w07x53z9hu2hhq8kn8n9e77vc0nztrl2h3sn4cgz9v0ps577a53',
		redbankAddress: process.env.REDBANK_ADDRESS || 'neutron14zjmuel0t8q9rqezp2vtj706ckl8eqtrkc2cjexsssh8vgpuzxdqjuqydr',
		accountNftAddress: process.env.ACCOUNT_NFT_ADDRESS || 'neutron128pgfadzvmck5qccgpcjwew4lgsn5e4ha82cu7rrnyg45rrpxessuqdnmt',
		marsParamsAddress: process.env.MARS_PARAMS_ADDRESS || 'neutron15tdtcemvkj3g7vuuz83twcekg86j3f58jet9lv08u0j7j8ztymsqd47l9z',
		creditManagerAddress: process.env.CREDIT_MANAGER_ADDRESS || 'neutron1gtqq647nrkgwxr3anrdty6fqfvfqav9kkwuu7el0gw754yx42dgs0s92zx',
		liquidatorMasterAddress: liquidatorMasterAddress,
		minGasTokens: 10000000,
		logResults: false,
		poolsRefreshWindow: 60000,
		maxLiquidators: process.env.MAX_LIQUIDATORS ? parseInt(process.env.MAX_LIQUIDATORS) : 10,
		stableBalanceThreshold : 5000000,
		sqsUrl: "https://sqs.osmosis.zone/"
	}
}
