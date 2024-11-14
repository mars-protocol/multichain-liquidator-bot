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
				safetyMargin: 0.05,
				astroportRouter: 'neutron1rwj6mfxzzrwskur73v326xwuff52vygqk73lr7azkehnfzz5f5wskwekf4',
				lcdEndpoint: process.env.LCD_ENDPOINT!, // use env vars in order to be able to quickly change
				gasDenom: 'untrn',
				hiveEndpoint: process.env.HIVE_ENDPOINT!,
				liquidatorMasterAddress: liquidatorMasterAddress,
				logResults: false,
				marsParamsAddress: 'neutron1x4rgd7ry23v2n49y7xdzje0743c5tgrnqrqsvwyya2h6m48tz4jqqex06x',
				neutralAssetDenom: 'ibc/B559A80D62249C8AA07A380E2A2BEA6E5CA9A6F079C912C3A9E9B494105E4F81',
				oracleAddress: 'neutron1dwp6m7pdrz6rnhdyrx5ha0acsduydqcpzkylvfgspsz60pj2agxqaqrr7g',
				redbankAddress: 'neutron1n97wnm7q6d2hrcna3rqlnyqw2we6k0l8uqvmyqq6gsml92epdu7quugyph',
				liquidationProfitMarginPercent: 0.001,
				poolsRefreshWindow: 60000,
				marsEndpoint: 'https://api.marsprotocol.io',
				astroportFactory: 'neutron1hptk0k5kng7hjy35vmh009qd5m6l33609nypgf2yc6nqnewduqasxplt4e',
		  }
		: {
				safetyMargin: 0.05,
				chainName: 'neutron',
				productName: 'redbank',
				lcdEndpoint: process.env.LCD_ENDPOINT!, // use env vars in order to be able to quickly change
				gasDenom: 'untrn',
				hiveEndpoint: process.env.HIVE_ENDPOINT!,
				liquidatorMasterAddress: liquidatorMasterAddress,
				logResults: false, // enable for debugging
				neutralAssetDenom: 'ibc/EFB00E728F98F0C4BBE8CA362123ACAB466EDA2826DC6837E49F4C1902F21BBA',
				oracleAddress: 'neutron1nx9txtmpmkt58gxka20z72wdkguw4n0606zkeqvelv7q7uc06zmsym3qgx',
				marsParamsAddress: 'todo',
				redbankAddress: 'neutron15dld0kmz0zl89zt4yeks4gy8mhmawy3gp4x5rwkcgkj5krqvu9qs4q7wve',
				astroportRouter: 'neutron12jm24l9lr9cupufqjuxpdjnnweana4h66tsx5cl800mke26td26sq7m05p',
				astroportFactory: 'neutron1jj0scx400pswhpjes589aujlqagxgcztw04srynmhf0f6zplzn2qqmhwj7',
				liquidationProfitMarginPercent: 0.001,
				poolsRefreshWindow: 60000,
		  }
}
