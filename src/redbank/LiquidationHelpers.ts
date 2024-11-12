import BigNumber from "bignumber.js"
import { Collateral, Debt } from "../query/types"
import { AssetParamsBaseForAddr, Coin } from "marsjs-types/mars-params/MarsParams.types"

export const calculatePositionLtv = (
    debts: Debt[],
    collaterals: Collateral[],
    prices: Map<string, BigNumber>,
    assetParams : Map<string, AssetParamsBaseForAddr>
) :number => {

    const totalDebtValue = getTotalValueOfCoinArray(debts, prices)

    const totalCollateralValue = getTotalLtvValueOfCollateral(collaterals, prices, assetParams)

    // Calculated as CR = Total Assets / Total Debt
    return totalCollateralValue.dividedBy(totalDebtValue).toNumber()

}

export const calculateCollateralRatio = (
    debts: Debt[],
    collaterals : Collateral[],
    prices: Map<string, BigNumber>
) : BigNumber => {
    const totalDebtValue = getTotalValueOfCoinArray(debts, prices)
    const totalCollateralValue = getTotalValueOfCoinArray(collaterals, prices)

    // Calculated as CR = Total Assets / Total Debt
    return totalCollateralValue.dividedBy(totalDebtValue)
}

// This is the maximum amount of debt the protocol will allow us to repay in this position
// Formula
// MDR = ((THF*Debt_0) - (LTV*Collateral_0))/(THF - (LTV * (1 + TLF)))
export const calculateMaxDebtRepayable = (
    targetHealthFactor : number,
    debts : Debt[],
    collaterals: Collateral[],
    assetParams: Map<string, AssetParamsBaseForAddr>,
    liquidationBonus: number,
    prices: Map<string, BigNumber>,
    claimedCollateralDenom : string 
) : BigNumber => {

    const totalDebtValue = getTotalValueOfCoinArray(debts, prices)
    const ltCollateralValue = getTotalLiquidationThresholdValueOfCollateral(collaterals, prices, assetParams)
    const thf = new BigNumber(targetHealthFactor)
    const lt = new BigNumber(assetParams.get(claimedCollateralDenom)?.liquidation_threshold || 0)

    const numerator = thf.multipliedBy(totalDebtValue).minus(ltCollateralValue)
    const denominator = thf.minus(lt.multipliedBy(1+liquidationBonus))
    
    return numerator.dividedBy(denominator)
}

export const calculateLiquidationBonus = (
    bonusStart : number,
    slope: number,
    healthFactor : number,
    maxLbSetting : number,
    minLbSetting : number,
    collateralRatio : number
) :number => {

    //maxLB* = max(min(CR - 1, maxLB), minLB)
    const maxLBCalc = Math.max(Math.min(collateralRatio - 1, maxLbSetting), minLbSetting)
    //Liquidation Bonus = min(B + (slope * (1 - HF)), maxLB*)
    const liquidationBonus = Math.min(bonusStart + (slope * (1-healthFactor)), maxLBCalc)

    return liquidationBonus
}

export const getTotalLtvValueOfCollateral = (collateral: Collateral[], prices: Map<string, BigNumber>, assetParams : Map<string, AssetParamsBaseForAddr>) => {
    return  collateral.reduce((acc, collateral) => {

        if (collateral.enabled === false) return acc
        
        const price = prices.get(collateral.denom)!;
        const value = new BigNumber(collateral.amount).multipliedBy(price);
        const assetLtv = new BigNumber(assetParams.get(collateral.denom)?.max_loan_to_value || 0)
        
        return acc.plus(value.multipliedBy(assetLtv));
      }, new BigNumber(0));
}

export const getTotalLiquidationThresholdValueOfCollateral = (collateral: Collateral[], prices: Map<string, BigNumber>, assetParams : Map<string, AssetParamsBaseForAddr>) => {
    return  collateral.reduce((acc, collateral) => {

        if (collateral.enabled === false) return acc
        
        const price = prices.get(collateral.denom)!;
        const value = price.multipliedBy(collateral.amount)
        const liquidationThreshold = new BigNumber(assetParams.get(collateral.denom)?.liquidation_threshold || 0)
        return acc.plus(value.multipliedBy(liquidationThreshold));
      }, new BigNumber(0));
}

export const getLiquidationThresholdHealthFactor = (
    collateral: Collateral[],
    debts: Debt[],
    prices: Map<string, BigNumber>,
    assetParams : Map<string, AssetParamsBaseForAddr>
) : number => {
    
        const totalDebtValue = getTotalValueOfCoinArray(debts, prices)
        const totalCollateralValue = getTotalLiquidationThresholdValueOfCollateral(collateral, prices, assetParams)

        return totalCollateralValue.dividedBy(totalDebtValue).toNumber()
}

export const getTotalValueOfCoinArray = (coins: Coin[], prices: Map<string,BigNumber>) =>  {
    return  coins.reduce((acc, debt) => {
        const price = prices.get(debt.denom)!;
        const value = price.multipliedBy(debt.amount);
        return acc.plus(value); // Accumulate the total value
      }, new BigNumber(0));
}