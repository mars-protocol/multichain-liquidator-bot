import { OsmosisPriceSourceForString } from 'marsjs-types/mars-oracle-osmosis/MarsOracleOsmosis.types'
import { WasmPriceSourceForString } from 'marsjs-types/mars-oracle-wasm/MarsOracleWasm.types'

export interface PriceSourceResponse {
	denom: string
	price_source: OsmosisPriceSourceForString | WasmPriceSourceForString
}
