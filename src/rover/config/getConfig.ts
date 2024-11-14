import { Network } from '../../types/network'
import { getConfig as getOsmosisConfig } from './osmosis'
import { getConfig as getNeutronConfig } from './neutron'

export const getConfig = (liquidatorAddress: string, network: Network, chainName: string) => {
	switch (chainName) {
		case 'osmosis':
			return getOsmosisConfig(liquidatorAddress, network)
		case 'neutron':
			return getNeutronConfig(liquidatorAddress, network)
		default:
			throw new Error(
				`Invalid chain name. Chain name must be either osmosis or neutron, recieved ${chainName}`,
			)
	}
}
