import BigNumber from 'bignumber.js'
import { Market } from 'marsjs-types/mars-red-bank/MarsRedBank.types'

export interface MarketInfo extends Market {
	available_liquidity: BigNumber
}
