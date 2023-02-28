import { Network } from '../../types/network'
import { RoverExecutorConfig } from '../RoverExecutor'

export const getConfig = (
	liquidatorMasterAddress: string,
	liquidatorAddress: string,
	network: Network,
): RoverExecutorConfig => {
	if (network === Network.MAINNET) throw new Error('Mainnet network not yet supported')

	return {
		gasDenom: 'uosmo',
		hiveEndpoint: process.env.HIVE_ENDPOINT!,
		lcdEndpoint: process.env.LCD_ENDPOINT!,
		neutralAssetDenom: 'uosmo', // no usdc pools on testnet so we use osmo
		swapperAddress: 'osmo1svc92mfvgfredd56ut83sy68vwzvd5nxu7844ljmlsrsxa8d8lssw7kd4x',
		oracleAddress: 'osmo1dqz2u3c8rs5e7w5fnchsr2mpzzsxew69wtdy0aq4jsd76w7upmsstqe0s8',
		redbankAddress: 'osmo1t0dl6r27phqetfu0geaxrng0u9zn8qgrdwztapt5xr32adtwptaq6vwg36',
		accountNftAddress: 'osmo16wwckvccarltl4mlnjhw3lcj3v59yglhldgw36ldkknmjavqyaasgcessw',
		creditManagerAddress: 'osmo1dzk4y3s9am6773sglhfc60nstz09c3gy978h2jka6wre5z4hlavq4pcwk0',
		liquidatorMasterAddress: liquidatorMasterAddress,
		liquidatorAddress: liquidatorAddress,
		minGasTokens: 10000000,
		logResults: false,
		redisEndpoint: process.env.REDIS_ENDPOINT || 'http://127:0.0.1:6379', // recommend using local
		poolsRefreshWindow: 60000,
	}
}
