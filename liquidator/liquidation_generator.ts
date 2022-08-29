import { Asset } from "./types/asset.js"
import { Position } from "./types/position.js"
import { LiquidationTx } from './types/liquidation.js'

export const createLiquidationTx = (position : Position) : LiquidationTx => {
    return {
        collateral_denom: getLargestCollateral(position.collaterals),
        debt_denom : getLargestDebt(position.debts),
        user_address : position.address,
        receive_ma_token : false
    }
}

// Sort asset array from highest amount to lowest
const sortAssetArrayByAmount = (assets: Asset[]) : Asset[] => {
    // deep copy, so we don't mess up the og array.
    const assetClone = [...assets]
    return assetClone.sort((a: Asset, b : Asset) => a.amount - b.amount).reverse()
}

export const getLargestCollateral = (collaterals : Asset[]) : string => {
   return sortAssetArrayByAmount(collaterals)[0].denom
}

export const getLargestDebt = (debts : Asset[]) : string => {
    return sortAssetArrayByAmount(debts)[0].denom
}