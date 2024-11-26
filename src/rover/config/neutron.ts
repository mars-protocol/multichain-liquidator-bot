import { Network } from '../../types/network'
import { RoverExecutorConfig as CreditManagerConfig } from '../RoverExecutor'

export const getConfig = (
	liquidatorMasterAddress: string,
	network: Network,
): CreditManagerConfig => {
	if (network === Network.MAINNET) {
		return {
			gasDenom: 'untrn',
			chainName: 'neutron',
			// Rover is called creditmanager in the api
			productName: 'creditmanager',
			hiveEndpoint: process.env.HIVE_ENDPOINT!,
			lcdEndpoint: process.env.LCD_ENDPOINT!,
			neutralAssetDenom: 'ibc/B559A80D62249C8AA07A380E2A2BEA6E5CA9A6F079C912C3A9E9B494105E4F81',
			//neutralAssetDenom: 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858',
			swapperAddress:
				process.env.SWAPPER_ADDRESS ||
				'neutron1udr9fc3kd743dezrj38v2ac74pxxr6qsx4xt4nfpcfczgw52rvyqyjp5au',
			oracleAddress:
				process.env.ORACLE_ADDRESS ||
				'neutron1dwp6m7pdrz6rnhdyrx5ha0acsduydqcpzkylvfgspsz60pj2agxqaqrr7g',
			redbankAddress:
				process.env.REDBANK_ADDRESS ||
				'neutron1n97wnm7q6d2hrcna3rqlnyqw2we6k0l8uqvmyqq6gsml92epdu7quugyph',
			accountNftAddress:
				process.env.ACCOUNT_NFT_ADDRESS ||
				'neutron184kvu96rqtetmunkkmhu5hru8yaqg7qfhd8ldu5avjnamdqu69squrh3f5',
			marsParamsAddress:
				process.env.MARS_PARAMS_ADDRESS ||
				'neutron1x4rgd7ry23v2n49y7xdzje0743c5tgrnqrqsvwyya2h6m48tz4jqqex06x',
			creditManagerAddress:
				process.env.CREDIT_MANAGER_ADDRESS ||
				'neutron1qdzn3l4kn7gsjna2tfpg3g3mwd6kunx4p50lfya59k02846xas6qslgs3r',
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
		gasDenom: 'untrn',
		chainName: 'neutron',
		productName: 'creditmanager',
		hiveEndpoint: process.env.HIVE_ENDPOINT!,
		lcdEndpoint: process.env.LCD_ENDPOINT!,
		neutralAssetDenom: 'factory/neutron1ke0vqqzyymlp5esr8gjwuzh94ysnpvj8er5hm7/UUSDC', // no usdc pools on testnet so we use osmo
		swapperAddress:
			process.env.SWAPPER_ADDRESS ||
			'neutron1dyltrt8aekyprrs3l838r02cpceed48hjtz3x8vqrzm0tukm3ktqtp5j49',
		oracleAddress:
			process.env.ORACLE_ADDRESS ||
			'neutron12vejgch3jd74j99kdrpjf57f6zjlu425yyfscdjnmnn4vvyrazvqgvcp24',
		redbankAddress:
			process.env.REDBANK_ADDRESS ||
			'neutron19ucpt6vyha2k6tgnex880sladcqsguwynst4f8krh9vuxhktwkvq3yc3nl',
		accountNftAddress:
			process.env.ACCOUNT_NFT_ADDRESS ||
			'neutron1pgk4ttz3ned9xvqlg79f4jumjet0443uqh2rga9ahalzgxqngtrqrszdna',
		marsParamsAddress:
			process.env.MARS_PARAMS_ADDRESS ||
			'neutron14a0qr0ahrg3f3yml06m9f0xmvw30ldf3scgashcjw5mrtyrc4aaq0v4tm9',
		creditManagerAddress:
			process.env.CREDIT_MANAGER_ADDRESS ||
			'neutron1zkxezh5e6jvg0h3kj50hz5d0yrgagkp0c3gcdr6stulw7fye9xlqygj2gz',
		liquidatorMasterAddress: liquidatorMasterAddress,
		minGasTokens: 1000000,
		logResults: false,
		poolsRefreshWindow: 60000,
		maxLiquidators: process.env.MAX_LIQUIDATORS ? parseInt(process.env.MAX_LIQUIDATORS) : 1,
		stableBalanceThreshold: 5000000,
		marsEndpoint: 'https://testnet-api.marsprotocol.io',
		sqsUrl: 'https://sqs.osmosis.zone/',
	}
}
