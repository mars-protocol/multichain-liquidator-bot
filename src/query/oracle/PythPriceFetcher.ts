import { OraclePrice, PriceFetcher } from './PriceFetcherInterface'
import BigNumber from 'bignumber.js'

export interface PythPriceFetcherParams {
	priceFeedId: string
	denomDecimals: number
	denom: string
}

interface PythPriceResponse {
	id: string
	price: {
		conf: string
		expo: string
		price: string
	}
}

export class PythPriceFetcher implements PriceFetcher {
	async fetchPrice(params: PythPriceFetcherParams): Promise<OraclePrice> {
		const pythPriceUrl = `https://xc-mainnet.pyth.network/api/latest_price_feeds?ids[]=${params.priceFeedId}`
		const response = await fetch(pythPriceUrl)
		const pythPriceResults: PythPriceResponse[] = await response.json()

		const priceResult = pythPriceResults[0].price

		// Mars oracle converts prices to uToken : uusd. Therefore our exponent from pyth needs to be adjusted
		const correctedExpo = Number(priceResult.expo) + (6 - params.denomDecimals)

		// convert to price
		const oraclePrice = new BigNumber(10 ^ correctedExpo).multipliedBy(priceResult.price)

		return {
			denom: params.denom,
			price: oraclePrice,
		}
	}
}
