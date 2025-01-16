import { mapValues } from 'lodash'
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
			contracts: mapValues({
				addressProvider: 'neutron1qr8wfk59ep3fmhyulhg75dw68dxrq7v6qfzufglgs4ry5wptx47sytnkav',
				redbank: 'neutron1n97wnm7q6d2hrcna3rqlnyqw2we6k0l8uqvmyqq6gsml92epdu7quugyph',
				incentives: 'neutron1aszpdh35zsaz0yj80mz7f5dtl9zq5jfl8hgm094y0j0vsychfekqxhzd39',
				oracle: 'neutron1dwp6m7pdrz6rnhdyrx5ha0acsduydqcpzkylvfgspsz60pj2agxqaqrr7g',
				rewardsCollector: 'neutron1dnh5urdl2e4ylpfzxgfd82lf5l3ydy5gync4tar35ax9c6lrv0fsgkqx9n',
				swapper: 'neutron1udr9fc3kd743dezrj38v2ac74pxxr6qsx4xt4nfpcfczgw52rvyqyjp5au',
				params: 'neutron1x4rgd7ry23v2n49y7xdzje0743c5tgrnqrqsvwyya2h6m48tz4jqqex06x',
				zapper: 'neutron13kvhvvem9t78shv8k9jrc6rsvjjnwhvylg3eh3qgssd4dx2234kq5aaekn',
				health: 'neutron14v200h6tawndkct9nenrg4x5kh0888kd8lx6l95m4932z2n5zn0qdfhtcq',
				creditManager: 'neutron1qdzn3l4kn7gsjna2tfpg3g3mwd6kunx4p50lfya59k02846xas6qslgs3r',
				accountNft: 'neutron184kvu96rqtetmunkkmhu5hru8yaqg7qfhd8ldu5avjnamdqu69squrh3f5',
				perps: 'neutron1g3catxyv0fk8zzsra2mjc0v4s69a7xygdjt85t54l7ym3gv0un4q2xhaf6',
			}),
			lcdEndpoint: process.env.LCD_ENDPOINT!,
			neutralAssetDenom: 'ibc/B559A80D62249C8AA07A380E2A2BEA6E5CA9A6F079C912C3A9E9B494105E4F81',
			//neutralAssetDenom: 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858',
			liquidatorMasterAddress: liquidatorMasterAddress,
			minGasTokens: 1000000,
			logResults: false,
			poolsRefreshWindow: 60000,
			maxLiquidators: process.env.MAX_LIQUIDATORS ? parseInt(process.env.MAX_LIQUIDATORS) : 10,
			stableBalanceThreshold: 5000000,
			// marsEndpoint: "http://127.0.0.1:3000",
			marsEndpoint: process.env.MARS_API_ENDPOINT
				? process.env.MARS_API_ENDPOINT
				: 'https://api.marsprotocol.io',
			sqsUrl: 'https://sqs.osmosis.zone/',
			usePerps: true,
		}
	}

	// Not mainnet
	return {
		gasDenom: 'untrn',
		chainName: 'neutron',
		productName: 'creditmanager',
		lcdEndpoint: process.env.LCD_ENDPOINT!,
		neutralAssetDenom: 'factory/neutron1ke0vqqzyymlp5esr8gjwuzh94ysnpvj8er5hm7/UUSDC', // no usdc pools on testnet so we use osmo
		contracts: mapValues({
			addressProvider: 'neutron1qr8wfk59ep3fmhyulhg75dw68dxrq7v6qfzufglgs4ry5wptx47sytnkav',
			redbank: 'neutron1n97wnm7q6d2hrcna3rqlnyqw2we6k0l8uqvmyqq6gsml92epdu7quugyph',
			incentives: 'neutron1aszpdh35zsaz0yj80mz7f5dtl9zq5jfl8hgm094y0j0vsychfekqxhzd39',
			oracle: 'neutron1dwp6m7pdrz6rnhdyrx5ha0acsduydqcpzkylvfgspsz60pj2agxqaqrr7g',
			rewardsCollector: 'neutron1dnh5urdl2e4ylpfzxgfd82lf5l3ydy5gync4tar35ax9c6lrv0fsgkqx9n',
			swapper: 'neutron1udr9fc3kd743dezrj38v2ac74pxxr6qsx4xt4nfpcfczgw52rvyqyjp5au',
			params: 'neutron1x4rgd7ry23v2n49y7xdzje0743c5tgrnqrqsvwyya2h6m48tz4jqqex06x',
			zapper: 'neutron13kvhvvem9t78shv8k9jrc6rsvjjnwhvylg3eh3qgssd4dx2234kq5aaekn',
			health: 'neutron14v200h6tawndkct9nenrg4x5kh0888kd8lx6l95m4932z2n5zn0qdfhtcq',
			creditManager: 'neutron1qdzn3l4kn7gsjna2tfpg3g3mwd6kunx4p50lfya59k02846xas6qslgs3r',
			accountNft: 'neutron1pgk4ttz3ned9xvqlg79f4jumjet0443uqh2rga9ahalzgxqngtrqrszdna',
			perps: 'neutron1g3catxyv0fk8zzsra2mjc0v4s69a7xygdjt85t54l7ym3gv0un4q2xhaf6',
		}),
		liquidatorMasterAddress: liquidatorMasterAddress,
		minGasTokens: 1000000,
		logResults: false,
		poolsRefreshWindow: 60000,
		maxLiquidators: process.env.MAX_LIQUIDATORS ? parseInt(process.env.MAX_LIQUIDATORS) : 1,
		stableBalanceThreshold: 5000000,
		marsEndpoint: process.env.MARS_API_ENDPOINT
			? process.env.MARS_API_ENDPOINT
			: 'https://testnet-api.marsprotocol.io',
		sqsUrl: 'https://sqs.osmosis.zone/',
		usePerps: true,
	}
}
