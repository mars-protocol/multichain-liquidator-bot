import { Coin } from "@cosmjs/amino";
import { BaseExecutor } from "../BaseExecutor";
import { sleep } from "../helpers";
import { fetchRoverPosition } from "../hive";
import { LiquidationHelper } from "../liquidation_helpers";
import { RedisInterface } from "../redis";
import { LiquidationActionGenerator } from "./LiquidationActionGenerator";
import { VaultPosition, VaultPositionAmount, VaultUnlockingPosition } from "@marsjs-types/creditmanager/mars-credit-manager/MarsCreditManager.types"
import BigNumber from "bignumber.js";
import { Collateral, Debt, PositionType } from "./types/RoverPosition";


export class Executor extends BaseExecutor {
    
    private liquidationActionGenerator : LiquidationActionGenerator
    private creditManagerAddress: string

    constructor(
        liquidationActionGenerator : LiquidationActionGenerator,
        creditManagerAddress: string
    ) {
        super();
        this.liquidationActionGenerator = liquidationActionGenerator
        this.creditManagerAddress = creditManagerAddress
    }

    start = async() => {
        // this will fetch prices etc
        this.initiate()
    }

    run = async() => {
        // pop latest unhealthy position from the list
        const addresses = await this.redis.popUnhealthyPositions(1)

        if (addresses.length == 0) {
            //sleep to avoid spamming redis db when empty
            await sleep(200)
            console.log(' - No items for liquidation yet')
            return
        }

        const roverPosition = await fetchRoverPosition(addresses[0].Address, this.creditManagerAddress)
        
        // find best collateral / debt
        const bestCollateral : Collateral = this.findBestCollateral(roverPosition.coins, roverPosition.vaults) 
        const bestDebt : Debt = this.findBestDebt(roverPosition.debts)

        //  - do message construction
        const borrowMessage = this.liquidationActionGenerator.produceBorrowActions(bestDebt, bestCollateral)


        // await execute() 
    }


    // TODO update this to factor route liquidity / efficiency into selection process.
    findBestCollateral =(collaterals : Coin[], vaultPositions: VaultPosition[]) : Collateral => {
        const largestCollateralCoin = collaterals.sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB)).pop()
        const largestCollateralVault = vaultPositions.sort((vaultA, vaultB) => this.calculateVaultValue(vaultA) - this.calculateVaultValue(vaultB)).pop()

        const bestCollateral : Coin | VaultPosition | undefined = this.calculateCoinValue(largestCollateralCoin) > this.calculateVaultValue(largestCollateralVault!) ? largestCollateralCoin : largestCollateralVault

        if (!bestCollateral) throw new Error("Failed to find a collateral")

        const isVault = (bestCollateral as VaultPosition).vault !== undefined

        return (!isVault) 
            ? {
                amount: Number((bestCollateral as Coin).amount),
                denom: (bestCollateral as Coin).denom,
                closeFactor : 0.5, // todo
                price: this.prices.get((bestCollateral as Coin).denom) || 0,
                type: PositionType.COIN
            }
            : {
                amount:Number(bestCollateral.amount),
                denom: (bestCollateral as VaultPosition).vault.address,
                closeFactor : 0.5, // todo
                price: this.prices.get((bestCollateral as VaultPosition).vault.address) || 0,
                type: PositionType.VAULT
            }

    }

    calculateCoinValue = (coin : Coin | undefined) : number => {
        
        if (!coin) return 0

        const amountBn = new BigNumber(coin?.amount)
        const price = new BigNumber(this.prices.get(coin.denom) || 0)
        return amountBn.multipliedBy(price).toNumber()
    }

    calculateVaultValue = (vault : VaultPosition | undefined) : number => {

        if (!vault) return 0

        // VaultPositionAmounts can be either locking or unlocked, but we don't know what one
        // until runtime, hence ts-ignore is used

        //@ts-ignore
        const vaultAmountLocked : BigNumber = new BigNumber(vault.amount.locking.locked)

        //@ts-ignore
        const vaultAmountUnlocked : BigNumber = new BigNumber(vault.amount.unlocked)

        //@ts-ignore
        const unlockingAmounts : VaultUnlockingPosition[] = vault.amount.locking.unlocking

        const largestUnlocking : Coin | undefined = unlockingAmounts.sort(
            (unlockA : VaultUnlockingPosition, unlockB: VaultUnlockingPosition) => this.calculateCoinValue(unlockA.coin) - this.calculateCoinValue(unlockB.coin)
        ).pop()?.coin

        // calculate whether locking or unlocked is greater
        const vaultAmount = vaultAmountLocked.isGreaterThan(vaultAmountUnlocked) ? vaultAmountLocked : vaultAmountUnlocked
        const price = new BigNumber(this.prices.get(vault.vault.address) || 0)
        const largestVaultValue = vaultAmount.multipliedBy(price)        

        const largestUnlockingValue = largestUnlocking ? new BigNumber(largestUnlocking.amount).multipliedBy(this.prices.get(largestUnlocking.denom) || 0) : new BigNumber(0)
        
        return largestVaultValue.isGreaterThan(largestUnlockingValue) ? largestVaultValue.toNumber() : largestUnlockingValue.toNumber()

    }

     // TODO update this to factor route liquidity / efficiency into selection process.
    findBestDebt =(debts : Coin[]) : Debt => {
        const largestDebt = debts.sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB)).pop()
      
        if (!largestDebt) throw new Error("Failed to find any debts")

        return {
                amount: Number((largestDebt as Coin).amount),
                denom: (largestDebt as Coin).denom,
                price: this.prices.get((largestDebt as Coin).denom) || 0,
            }

    }
}