import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { OraclePrice, PriceFetcher } from './PriceFetcherInterface'
import BigNumber from 'bignumber.js'

export interface OsmosisOraclePriceFetcherParams {
	oracleAddress: string
	priceDenom: string
}

export class OraclePriceFetcher implements PriceFetcher {
	constructor(private client: CosmWasmClient) {}

	async fetchPrice(params: OsmosisOraclePriceFetcherParams): Promise<OraclePrice> {
		const result = await this.client.queryContractSmart(params.oracleAddress, {
			price: { denom: params.priceDenom },
		})

		return {
			denom: result.denom,
			price: new BigNumber(result.price),
		}
	}
}
