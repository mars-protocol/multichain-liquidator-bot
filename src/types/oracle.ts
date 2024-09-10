import { OsmosisPriceSourceForString } from "marsjs-types/redbank/generated/mars-oracle-osmosis/MarsOracleOsmosis.types";
import { WasmPriceSourceForString } from "marsjs-types/redbank/generated/mars-oracle-wasm/MarsOracleWasm.types";

export interface PriceSourceResponse {
	denom: string,
	price_source: OsmosisPriceSourceForString | WasmPriceSourceForString
}