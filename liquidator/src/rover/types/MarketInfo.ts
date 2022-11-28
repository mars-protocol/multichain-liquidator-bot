import { Market } from "./generated/mars-red-bank/MarsRedBank.types";

export interface MarketInfo extends Market{
    available_liquidity : number
}