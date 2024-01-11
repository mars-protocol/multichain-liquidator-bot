import { Network } from '../../types/network'
import { RedbankExecutorConfig } from '../RedbankExecutor'

export const getConfig = (
	liquidatorMasterAddress: string,
	network: Network,
): RedbankExecutorConfig => {
	return network === Network.MAINNET
		? {
				liquidatableAssets: JSON.parse(process.env.LIQUIDATABLE_ASSETS!) as string[],
				liquidationFiltererAddress: process.env.LIQUIDATION_FILTERER_CONTRACT!, // todo hardcode here
				safetyMargin: 0.05,
				chainName: "osmosis",
				lcdEndpoint: process.env.LCD_ENDPOINT!, // use env vars in order to be able to quickly change
				gasDenom: 'uosmo',
				hiveEndpoint: process.env.HIVE_ENDPOINT!,
				liquidatorMasterAddress: liquidatorMasterAddress,
				logResults: false, // enable for debugging
				neutralAssetDenom: 'ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4',
				oracleAddress: 'osmo1mhznfr60vjdp2gejhyv2gax9nvyyzhd3z0qcwseyetkfustjauzqycsy2g',
				marsParamsAddress: process.env.MARS_PARAMS_ADDRESS || 'osmo1nlmdxt9ctql2jr47qd4fpgzg84cjswxyw6q99u4y4u4q6c2f5ksq7ysent',
				redbankAddress: 'osmo1c3ljch9dfw5kf52nfwpxd2zmj2ese7agnx0p9tenkrryasrle5sqf3ftpg',
				redisEndpoint: process.env.REDIS_ENDPOINT!,
				poolsRefreshWindow: 60000,
				liquidationProfitMarginPercent: 0.01,
				marsEndpoint: "https://api.marsprotocol.io"
		  }
		: {
				liquidatableAssets: JSON.parse(process.env.LIQUIDATABLE_ASSETS!) as string[],
				liquidationFiltererAddress: process.env.LIQUIDATION_FILTERER_CONTRACT!,
				chainName: "osmosis",
				safetyMargin: 0.05,
				lcdEndpoint: process.env.LCD_ENDPOINT!,
				gasDenom: 'uosmo',
				hiveEndpoint: process.env.HIVE_ENDPOINT!,
				liquidatorMasterAddress: liquidatorMasterAddress,
				logResults: false, // enable for debugging
				neutralAssetDenom: 'uosmo', // no usdc pools on testnet
				oracleAddress: 'osmo1dqz2u3c8rs5e7w5fnchsr2mpzzsxew69wtdy0aq4jsd76w7upmsstqe0s8',
				marsParamsAddress: '',
				redbankAddress: 'osmo1t0dl6r27phqetfu0geaxrng0u9zn8qgrdwztapt5xr32adtwptaq6vwg36',
				redisEndpoint: '',
				poolsRefreshWindow: 60000,
				liquidationProfitMarginPercent: 0.01
		  }
}
