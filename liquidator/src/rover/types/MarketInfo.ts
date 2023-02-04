import { Market } from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types'

export interface MarketInfo extends Market {
  available_liquidity: number
}
