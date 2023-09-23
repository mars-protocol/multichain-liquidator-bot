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
				lcdEndpoint: process.env.LCD_ENDPOINT!, // use env vars in order to be able to quickly change
				gasDenom: 'neutron',
				hiveEndpoint: process.env.HIVE_ENDPOINT!,
				liquidatorMasterAddress: liquidatorMasterAddress,
				logResults: false, // enable for debugging
				neutralAssetDenom: 'ntrn',
				marsParamsAddress: 'todo',
				oracleAddress: 'neutron1nx9txtmpmkt58gxka20z72wdkguw4n0606zkeqvelv7q7uc06zmsym3qgx',
				redbankAddress: 'neutron15dld0kmz0zl89zt4yeks4gy8mhmawy3gp4x5rwkcgkj5krqvu9qs4q7wve',
				redisEndpoint: process.env.REDIS_ENDPOINT!,
				liquidationProfitMarginPercent: 0.001,
				poolsRefreshWindow: 60000,
		  }
		: {
			liquidatableAssets: JSON.parse(process.env.LIQUIDATABLE_ASSETS!) as string[],
			liquidationFiltererAddress: process.env.LIQUIDATION_FILTERER_CONTRACT!, // todo hardcode here
			safetyMargin: 0.05,
			lcdEndpoint: process.env.LCD_ENDPOINT!, // use env vars in order to be able to quickly change
			gasDenom: 'uosmo',
			hiveEndpoint: process.env.HIVE_ENDPOINT!,
			liquidatorMasterAddress: liquidatorMasterAddress,
			logResults: false, // enable for debugging
			neutralAssetDenom: 'ibc/EFB00E728F98F0C4BBE8CA362123ACAB466EDA2826DC6837E49F4C1902F21BBA',
			oracleAddress: 'neutron1nx9txtmpmkt58gxka20z72wdkguw4n0606zkeqvelv7q7uc06zmsym3qgx',
			marsParamsAddress: 'todo',
			redbankAddress: 'neutron15dld0kmz0zl89zt4yeks4gy8mhmawy3gp4x5rwkcgkj5krqvu9qs4q7wve',
			redisEndpoint: process.env.REDIS_ENDPOINT!,
			liquidationProfitMarginPercent: 0.001,
			poolsRefreshWindow: 60000,
	  }
}
