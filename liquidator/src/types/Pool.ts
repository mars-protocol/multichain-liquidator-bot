import { Coin } from "@cosmjs/amino"

export interface Pool {
    address: string
    id: Long
    swapFee : string
    poolAssets: Coin[]
}