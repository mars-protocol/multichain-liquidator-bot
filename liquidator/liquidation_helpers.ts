import { ExecuteResult, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { coin, Coin, logs } from "@cosmjs/stargate";
import { Attribute, Event } from "@cosmjs/stargate/build/logs";
import { LcdPool, OsmosisApiClient } from "cosmology";
import { createLiquidationTx } from "./liquidation_generator";
import { LiquidationResult, LiquidationTx } from "./types/liquidation";
import { Position } from "./types/position";
import { osmosis } from 'osmojs'
import { SwapAmountInRoute } from "osmojs/types/proto/osmosis/gamm/v1beta1/tx";
const {
    swapExactAmountIn
} = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl;

export interface ILiquidationHelper {

    // Produce the ts required to liquidate a position
    produceLiquidationTx(address: Position) : LiquidationTx
    sendLiquidationTxs(txs: LiquidationTx[], coins: Coin[]) : Promise<LiquidationResult[]>
    swap(assetInDenom : string, assetOutDenom: string, assetInAmount: number) : Promise<void> // todo need type?
}

export class LiquidationHelper implements ILiquidationHelper {

    private client : SigningCosmWasmClient
    private liquidatorAddress: string
    private liquidationFilterContract : string

    constructor(
        client : SigningCosmWasmClient, 
        liquidatorAddress: string, 
        liquidationFilterContract: string) {
        this.client = client
        this.liquidatorAddress = liquidatorAddress
        this.liquidationFilterContract = liquidationFilterContract
    }

    // Find a pool Id where we can swap asset A with asset B.
    // Note that this will only work for direct routes (i.e a pool of A:B or B:A).
    async findRoute(denomA : string, denomB: string) : Promise<SwapAmountInRoute[]> {
        const api = new OsmosisApiClient({ url: process.env.RPC_ENDPOINT! })
        const lcdPools = await api.getPools();
        let poolId = ''
        lcdPools.pools.forEach((pool: LcdPool) => {
            const tokenA = pool.poolAssets[0].token
            const tokenB = pool.poolAssets[1].token
            if (
                tokenA.denom === denomA || tokenB.denom === denomA && 
                tokenA.denom === denomB || tokenB.denom === denomB
                ) {
                    poolId = pool.id
            }
        })

        // @ts-ignore
        return [{poolId:  Long.fromString(poolId), tokenOutDenom: denomB}]
    }
    
    /**
     * Swap the collateral recieved to recover the asset we used to repay the debt
     * 
     * TODO make this chain agnostic
     * 
     * @param assetInDenom  The asset we offer
     * @param assetOutDenom The asset we want to to recieve. 
     * @param assetInAmount The amount we are offering
     */
    async swap(assetInDenom : string, assetOutDenom: string, assetInAmount: number): Promise<void> {

        const route = await this.findRoute(assetInDenom, assetOutDenom)
    
        swapExactAmountIn({
            sender: this.liquidatorAddress,
            routes: route,
            tokenIn: coin(assetInAmount, assetInDenom),

            // Should we have a min amount here? It is very important the swap succeds, but at the same time
            // this makes us vulnerable to slippage / low liquidity / frontrunning etc
            tokenOutMinAmount: '0' 
          })
    }

    async sendLiquidationTxs(txs: LiquidationTx[], coins: Coin[]): Promise<LiquidationResult[]> {
        
        const msg = {
            "liquidate_many" : {
              "liquidations" :txs
          }
        }
      
        const result = await this.client.execute(this.liquidatorAddress, this.liquidationFilterContract, msg, "auto", undefined, coins)
        return this.parseLiquidationResult(result)        
    }

    parseLiquidationResult(result: ExecuteResult) : LiquidationResult[] {

        const liquidationResults : LiquidationResult[] = []

        result.logs[0].events.forEach((e) => {
            if (e.type === "wasm")
                liquidationResults.push(this.parseLiquidationResultInner(e))
        })

        return liquidationResults
    }

    parseLiquidationResultInner(wasm: Event) : LiquidationResult {

        const result : LiquidationResult = {
            collateralReceivedDenom : '',
            debtRepaidDenom: '',
            debtRepaidAmount: '',
            collateralReceivedAmount: ''
        }

         wasm.attributes.forEach((attribute: Attribute) => {
            // find all parameters
            switch(attribute.key) {
                case "collateral_denom":
                    result.collateralReceivedDenom = attribute.value
                    break
                case "debt_denom":
                    result.debtRepaidDenom = attribute.value
                    break
                case "collateral_amount_liquidated":
                    result.collateralReceivedAmount = attribute.value
                    break
                case "debt_amount_repaid":
                    result.debtRepaidAmount = attribute.value
                    break
            }
         })

         return result
    }
    
    produceLiquidationTx(position: Position): LiquidationTx {
        return createLiquidationTx(position)
    }

}