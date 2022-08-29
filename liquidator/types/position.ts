import { Asset } from "./asset"

export interface Position {
    address : string
    debts : Asset[]
    collaterals : Asset[]
}
