import { Network } from '../../types/network'
import { RoverExecutorConfig } from '../RoverExecutor'

export const getConfig = (
	liquidatorMasterAddress: string,
	network: Network,
): RoverExecutorConfig => {
	if (network === Network.MAINNET) {
		return {
			gasDenom: 'uosmo',
			chainName: "osmosis",
			hiveEndpoint: process.env.HIVE_ENDPOINT!,
			lcdEndpoint: process.env.LCD_ENDPOINT!,
			//neutralAssetDenom: 'ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4', 
			
			neutralAssetDenom: 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858', 
			swapperAddress: process.env.SWAPPER_ADDRESS || 'osmo1wee0z8c7tcawyl647eapqs4a88q8jpa7ddy6nn2nrs7t47p2zhxswetwla',
			oracleAddress: process.env.ORACLE_ADDRESS || 'osmo1mhznfr60vjdp2gejhyv2gax9nvyyzhd3z0qcwseyetkfustjauzqycsy2g',
			redbankAddress: process.env.REDBANK_ADDRESS || 'osmo1c3ljch9dfw5kf52nfwpxd2zmj2ese7agnx0p9tenkrryasrle5sqf3ftpg',
			accountNftAddress: process.env.ACCOUNT_NFT_ADDRESS || 'osmo1450hrg6dv2l58c0rvdwx8ec2a0r6dd50hn4frk370tpvqjhy8khqw7sw09',
			// todo once deployed
			marsParamsAddress: process.env.MARS_PARAMS_ADDRESS || 'osmo1nlmdxt9ctql2jr47qd4fpgzg84cjswxyw6q99u4y4u4q6c2f5ksq7ysent',
			creditManagerAddress: process.env.CREDIT_MANAGER_ADDRESS || 'osmo1f2m24wktq0sw3c0lexlg7fv4kngwyttvzws3a3r3al9ld2s2pvds87jqvf',
			liquidatorMasterAddress: liquidatorMasterAddress,
			minGasTokens: 1000000,
			logResults: false,
			redisEndpoint: process.env.REDIS_ENDPOINT || '', // recommend using local
			poolsRefreshWindow: 60000,
			maxLiquidators: 10,
			stableBalanceThreshold: 5000000,
			marsEndpoint: "https://api.marsprotocol.io"
		}
	}

	// Not mainnet
	return {
		gasDenom: 'uosmo',
		chainName : "osmosis",
		hiveEndpoint: process.env.HIVE_ENDPOINT!,
		lcdEndpoint: process.env.LCD_ENDPOINT!,
		neutralAssetDenom: 'uosmo', // no usdc pools on testnet so we use osmo
		swapperAddress: process.env.SWAPPER_ADDRESS || 'osmo17c4retwuyxjxzv9f2q9r0272s8smktpzhjetssttxxdavarjtujsjqafa2',
		oracleAddress: process.env.ORACLE_ADDRESS || 'osmo1dh8f3rhg4eruc9w7c9d5e06eupqqrth7v32ladwkyphvnn66muzqxcfe60',
		redbankAddress: process.env.REDBANK_ADDRESS || 'osmo1pvrlpmdv3ee6lgmxd37n29gtdahy4tec7c5nyer9aphvfr526z6sff9zdg',
		accountNftAddress: process.env.ACCOUNT_NFT_ADDRESS || 'osmo1j0m37hqpaeh79cjrdna4sep6yfyu278rrm4qta6s4hjq6fv3njxqsvhcex',
		marsParamsAddress: process.env.MARS_PARAMS_ADDRESS || 'osmo1dpwu03xc45vpqur6ry69xjhltq4v0snrhaukcp4fvhucx0wypzhs978lnp',
		creditManagerAddress: process.env.CREDIT_MANAGER_ADDRESS || 'osmo12wd0rwuvu7wwujztkww5c7sg4fw4e6t235jyftwy5ydc48uxd24q4s9why',
		liquidatorMasterAddress: liquidatorMasterAddress,
		minGasTokens: 10000000,
		logResults: false,
		redisEndpoint: process.env.REDIS_ENDPOINT || '', // recommend using local
		poolsRefreshWindow: 60000,
		maxLiquidators: 100,
		stableBalanceThreshold : 5000000
	}
}
