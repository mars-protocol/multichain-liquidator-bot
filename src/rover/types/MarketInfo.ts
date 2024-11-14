import BigNumber from 'bignumber.js'
import { MarketV2Response } from 'marsjs-types/mars-red-bank/MarsRedBank.types'

export interface MarketInfo extends MarketV2Response {
	available_liquidity: BigNumber
}
