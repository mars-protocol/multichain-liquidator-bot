import { Asset } from './asset'

export interface Position {
  Address: string
  Debts: Asset[]
  collaterals: Asset[]
}
