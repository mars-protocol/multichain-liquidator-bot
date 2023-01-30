import { Coin } from "@cosmjs/amino";
import { BaseExecutor, BaseExecutorConfig } from "../BaseExecutor";
import { makeExecuteContractMessage, sleep } from "../helpers";
import { toUtf8 } from '@cosmjs/encoding'
import { fetchRoverPosition } from "../hive";
import { LiquidationActionGenerator } from "./LiquidationActionGenerator";
import { VaultPosition, VaultPositionAmount, VaultUnlockingPosition } from "@marsjs-types/creditmanager/mars-credit-manager/MarsCreditManager.types"
import BigNumber from "bignumber.js";
import { Collateral, Debt, PositionType } from "./types/RoverPosition";
import { SigningStargateClient } from "@cosmjs/stargate";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { EncodeObject } from "@cosmjs/proto-signing";

export interface RoverExecutorConfig extends BaseExecutorConfig{
    creditManagerAddress: string
    liquidatorAddress: string
    minGasTokens: number
  }

export class Executor extends BaseExecutor {
    
    public config : RoverExecutorConfig
    private liquidationActionGenerator : LiquidationActionGenerator
    
    private liquidatorAccountId = -1

    constructor(
        config: RoverExecutorConfig,
        client: SigningStargateClient,
        queryClient: CosmWasmClient
    ) {
        super(config, client, queryClient)
        this.config = config
        this.liquidationActionGenerator = new LiquidationActionGenerator(this.ammRouter)
    }

    start = async() => {
        // this will fetch prices etc
        this.initiate()
        
        // check our gas balance - if we have no balance then we need to send some tokens to it.
        const balanceCoin = await this.queryClient.getBalance(this.config.liquidatorAddress, this.config.gasDenom)
        const balance = Number(balanceCoin.amount)

        // if less than min tokens, we need to top up
        if (balance <= this.config.minGasTokens) {

            // send from our master to our liquidator
            const tokensToSend = this.config.minGasTokens - balance
            const result = await this.client.sendTokens(
                this.config.liquidatorMasterAddress, 
                this.config.liquidatorAddress, 
                [{denom: this.config.gasDenom, amount: tokensToSend.toFixed(0)}],
                "auto")
            
            if (result.code !== 0) {
                console.warn(`Failed to top up gas for liquidator ${this.config.liquidatorAddress}. Current balance: ${balance}${this.config.gasDenom}`)
            }
        }
       
        // Mint an account. This is somewhat questionable - it means that we generate
        // a new credit account every time we boot up a new executor service. We may boot
        // up and kill executors semi often, which can lead to them having several credit accounts.
        // This will not result in leaking / stuck funds as they are all withdrawn after an 
        // action but it is gas inefficient. A query for existing credit accounts first would be better.
        const result = await this.client.signAndBroadcast(
            this.config.liquidatorAddress, 
            [
                makeExecuteContractMessage(
                    this.config.liquidatorAddress,
                    this.config.creditManagerAddress, 
                    toUtf8(`{ "create_credit_account": {} }`))
            ]
            ,'auto')

        // todo : parse credit account and get account id
        if (result.code !== 0) {
            throw new Error(`Failed to create credit account for ${this.config.liquidatorAddress}. TxHash: ${result.transactionHash}`)
        }
        
        while (true) await this.run()

    }

    run = async() => {

        // pop latest unhealthy position from the list
        const targetAccountId = await this.redis.popUnhealthyRoverAccountId()

        if (targetAccountId.length == 0) {
            //sleep to avoid spamming redis db when empty
            await sleep(200)
            console.log(' - No items for liquidation yet')
            return
        }

        const roverPosition = await fetchRoverPosition(targetAccountId, this.config.creditManagerAddress)

        // find best collateral / debt
        const bestCollateral : Collateral = this.findBestCollateral(roverPosition.coins, roverPosition.vaults) 
        const bestDebt : Debt = this.findBestDebt(roverPosition.debts)

        //  - do message construction
        // borrow messages will include the swap if we cannot borrow debt asset directly
        const borrowMessage = this.liquidationActionGenerator.produceBorrowActions(
            bestDebt, 
            bestCollateral,
            this.markets)

        const liquidateMessage = this.liquidationActionGenerator.produceLiquidationAction(
            bestCollateral.type,
            { denom: bestDebt.denom, amount: bestDebt.amount.toFixed(0)},
            roverPosition.account_id,
            bestCollateral.denom) // todo find type

        const swapToDebtMsg = this.liquidationActionGenerator.generateSwapActions(
            bestCollateral.denom, 
            bestDebt.denom, 
            bestDebt.amount.toFixed(0))

        const repayMsg = this.liquidationActionGenerator.generateRepayActions(
            bestCollateral.denom, 
            bestDebt.denom)
        
        // todo estimate amount based on repay to prevent slippage. 
        // note : the actual msg does not use the amount passed here - it just swaps everything in the credit account
        // note 2 : The asset here will be debt, not collateral - as we swap all the collateral to debt asset above
        const swapToStableMsg = bestCollateral.denom !== this.config.neutralAssetDenom 
            ? this.liquidationActionGenerator.generateSwapActions(
                bestDebt.denom, 
                this.config.neutralAssetDenom, '100')
            : []

        const actions = borrowMessage
            .concat(liquidateMessage)
            .concat(swapToDebtMsg)
            .concat(repayMsg)
            .concat(swapToStableMsg)
          //  .concat(withdraw) // todo

        const msg = { update_credit_account: { account_id : this.liquidatorAccountId, actions: actions }}

        const result = await this.client.signAndBroadcast(
            this.config.liquidatorAddress,
            [
                makeExecuteContractMessage(
                    this.config.liquidatorAddress,
                    this.config.creditManagerAddress,
                    toUtf8(JSON.stringify(msg)))
            ],
            "auto"
        )

        if (result.code !== 0 ) {
            console.log(`Liquidation failed. TxHash: ${result.transactionHash}`)
        } else {
            console.log(`Liquidation successfull. TxHash: ${result.transactionHash}`)
            // todo parse and log events?
        }
    }

    findBestCollateral =(collaterals : Coin[], vaultPositions: VaultPosition[]) : Collateral => {
        const largestCollateralCoin = collaterals.sort(
            (coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB)).pop()
        const largestCollateralVault = vaultPositions.sort(
            (vaultA, vaultB) => this.calculateVaultValue(vaultA) - this.calculateVaultValue(vaultB)).pop()

        const bestCollateral : Coin | VaultPosition | undefined = 
            this.calculateCoinValue(largestCollateralCoin) > this.calculateVaultValue(largestCollateralVault!) 
                ? largestCollateralCoin 
                : largestCollateralVault

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