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
				addressProvider: 'neutron1fg5v00sa0x3avsxa4rft5v9sgktl3s6fvkjwxy03lplcc6hrqxps08u2lc',
				redbank: 'neutron1xucw5lg7sh9gmupd90jaeupvq0nm4pj5esu3ff7f64pacy2lyjsqfwft80',
				incentives: 'neutron1uf6nclgqvwnqv5lfverunenpzyw556h739sekj75k62h062k9lrqzhm3up',
				oracle: 'neutron14rjfsglulewu9narj077ata6p0dkfjjuayguku50f8tg2fyf4ups44a0ww',
				rewardsCollector: 'neutron1l0ehl3wptumpyg85csv6n5dky93h4sph4ypfjpztnu4cj7kg9uvstzlwrr',
				swapper: 'neutron1t29va54hgzsakwuh2azpr77ty793h57yd978gz0dkekvyqrpcupqhhy6g3',
				params: 'neutron102xprj349yslxu5xncpsmv8qk38ryag870xvgxgm5r9dnagvetwszssu59',
				zapper: 'neutron16604kpsj3uptdxharvdn5w4ps3j7lydudn0dprwnmg5aj35uhatqse2l37',
				health: 'neutron18g6w7vkqwkdkexzl227g5h7464lzx4et4l5w9aawp8j7njf6gjkqrzpuug',
				creditManager: 'neutron1eekxmplmetd0eq2fs6lyn5lrds5nwa92gv5nw6ahjjlu8xudm2xs03784t',
				accountNft: 'neutron1jdpceeuzrptvrvvln3f72haxwl0w38peg6ux76wrm3d265ghne7se4wug2',
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
			redbank: 'neutron19ucpt6vyha2k6tgnex880sladcqsguwynst4f8krh9vuxhktwkvq3yc3nl',
			incentives: 'neutron1xqfgy03gulfyv6dnz9ezsjkgcvsvlaajskw35cluux9g05cmcu4sfdkuvc',
			oracle: 'neutron12vejgch3jd74j99kdrpjf57f6zjlu425yyfscdjnmnn4vvyrazvqgvcp24',
			rewardsCollector: 'neutron1dnh5urdl2e4ylpfzxgfd82lf5l3ydy5gync4tar35ax9c6lrv0fsgkqx9n',
			swapper: 'neutron1dyltrt8aekyprrs3l838r02cpceed48hjtz3x8vqrzm0tukm3ktqtp5j49',
			params: 'neutron14a0qr0ahrg3f3yml06m9f0xmvw30ldf3scgashcjw5mrtyrc4aaq0v4tm9',
			zapper: 'neutron13kvhvvem9t78shv8k9jrc6rsvjjnwhvylg3eh3qgssd4dx2234kq5aaekn',
			health: 'neutron14v200h6tawndkct9nenrg4x5kh0888kd8lx6l95m4932z2n5zn0qdfhtcq',
			creditManager: 'neutron1zkxezh5e6jvg0h3kj50hz5d0yrgagkp0c3gcdr6stulw7fye9xlqygj2gz',
			accountNft: 'neutron1pgk4ttz3ned9xvqlg79f4jumjet0443uqh2rga9ahalzgxqngtrqrszdna',
			perps: 'neutron1dcv8sy6mhgjaum5tj8lghxgxx2jgf3gmcw6kg73rj70sx5sjpguslzv0xu',
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
	}
}
