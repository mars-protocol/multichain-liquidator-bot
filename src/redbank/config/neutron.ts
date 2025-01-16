import { mapValues } from 'lodash'
import { Network } from '../../types/network'
import { RedbankExecutorConfig } from '../RedbankExecutor'

export const getConfig = (
	liquidatorMasterAddress: string,
	network: Network,
): RedbankExecutorConfig => {
	return network === Network.MAINNET
		? {
				chainName: 'neutron',
				productName: 'redbank',
				apiVersion: 'v1',
				safetyMargin: 0.05,
				contracts: mapValues({
					addressProvider: 'neutron17yehp4x7n79zq9dlw4g7xmnrvwdjjj2yecq26844sg8yu74knlxqfx5vqv',
					redbank: 'neutron1n97wnm7q6d2hrcna3rqlnyqw2we6k0l8uqvmyqq6gsml92epdu7quugyph',
					incentives: 'neutron1aszpdh35zsaz0yj80mz7f5dtl9zq5jfl8hgm094y0j0vsychfekqxhzd39',
					oracle: 'neutron1dwp6m7pdrz6rnhdyrx5ha0acsduydqcpzkylvfgspsz60pj2agxqaqrr7g',
					rewardsCollector: 'neutron1h4l6rvylzcuxwdw3gzkkdzfjdxf4mv2ypfdgvnvag0dtz6x07gps6fl2vm',
					swapper: 'neutron1udr9fc3kd743dezrj38v2ac74pxxr6qsx4xt4nfpcfczgw52rvyqyjp5au',
					params: 'neutron1x4rgd7ry23v2n49y7xdzje0743c5tgrnqrqsvwyya2h6m48tz4jqqex06x',
					zapper: 'neutron1dr0ckm3u2ztjuscmgqjr85lwyduphxkgl3tc02ac8zp54r05t5dqp5tgyq',
					health: 'neutron17ktfwsr7ghlxzzma0gw0hke3j3rnssd58q87jv2wzfrk6uhawa3sv8xxtm',
					creditManager: 'neutron1qdzn3l4kn7gsjna2tfpg3g3mwd6kunx4p50lfya59k02846xas6qslgs3r',
					accountNft: 'neutron184kvu96rqtetmunkkmhu5hru8yaqg7qfhd8ldu5avjnamdqu69squrh3f5',
				}),
				astroportRouter: 'neutron1rwj6mfxzzrwskur73v326xwuff52vygqk73lr7azkehnfzz5f5wskwekf4',
				lcdEndpoint: process.env.LCD_ENDPOINT!, // use env vars in order to be able to quickly change
				gasDenom: 'untrn',
				liquidatorMasterAddress: liquidatorMasterAddress,
				logResults: false,
				neutralAssetDenom: 'ibc/B559A80D62249C8AA07A380E2A2BEA6E5CA9A6F079C912C3A9E9B494105E4F81',
				liquidationProfitMarginPercent: 0.001,
				poolsRefreshWindow: 60000,
				marsEndpoint: process.env.MARS_API_ENDPOINT
					? process.env.MARS_API_ENDPOINT
					: 'https://api.marsprotocol.io',
				astroportFactory: 'neutron1hptk0k5kng7hjy35vmh009qd5m6l33609nypgf2yc6nqnewduqasxplt4e',
		  }
		: {
				safetyMargin: 0.05,
				chainName: 'neutron',
				productName: 'redbank',
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
				lcdEndpoint: process.env.LCD_ENDPOINT!, // use env vars in order to be able to quickly change
				gasDenom: 'untrn',
				liquidatorMasterAddress: liquidatorMasterAddress,
				logResults: false, // enable for debugging
				marsEndpoint: process.env.MARS_API_ENDPOINT
					? process.env.MARS_API_ENDPOINT
					: 'https://testnet-api.marsprotocol.io',
				apiVersion: 'v1',
				neutralAssetDenom: 'ibc/EFB00E728F98F0C4BBE8CA362123ACAB466EDA2826DC6837E49F4C1902F21BBA',
				astroportRouter: 'neutron12jm24l9lr9cupufqjuxpdjnnweana4h66tsx5cl800mke26td26sq7m05p',
				astroportFactory: 'neutron1jj0scx400pswhpjes589aujlqagxgcztw04srynmhf0f6zplzn2qqmhwj7',
				liquidationProfitMarginPercent: 0.001,
				poolsRefreshWindow: 60000,
		  }
}
