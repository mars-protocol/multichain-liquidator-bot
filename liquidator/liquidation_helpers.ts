import { ExecuteResult, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Coin, logs } from "@cosmjs/stargate";
import { Attribute, Event } from "@cosmjs/stargate/build/logs";
import { LiquidationResult, LiquidationTx } from "./types/liquidation";
import { Position } from "./types/position";

export interface ILiquidationHelper {

    // Produce the ts required to liquidate a position
    produceLiquidationTx(address: Position) : LiquidationTx
    sendLiquidationTxs(txs: LiquidationTx[], coins: Coin[]) : Promise<LiquidationResult[]>
    swap(assetInDenom : string, assetOutDenom: string) : Promise<void> // todo need type?
}


export class LiquidationHelper implements ILiquidationHelper {

    private client : SigningCosmWasmClient
    private liquidatorAddress: string
    private liquidationFilterContract : string

    constructor(client : SigningCosmWasmClient, liquidatorAddress: string, liquidationFilterContract: string) {
        this.client = client
        this.liquidatorAddress = liquidatorAddress
        this.liquidationFilterContract = liquidationFilterContract
    }
    
    async swap(result: LiquidationResult): Promise<void> {

        
        // dispatch a swap message to osmosis
        // need pool ids
        // 

        throw new Error("Method not implemented.");
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
            collateralRecievedDenom : '',
            debtRepaidDenom: '',
            debtRepaidAmount: '',
            amount: ''
        }

         // seach for 'collateral_denom' and 'collateral_amount_liquidated'
         wasm.attributes.forEach((attribute: Attribute) => {
            // find all parameters
            switch(attribute.key) {
                case "collateral_denom":
                    result.collateralRecievedDenom = attribute.value
                    break
                case "debt_denom":
                    result.debtRepaidDenom = attribute.value
                    break
                case "collateral_amount_liquidated":
                    result.amount = attribute.value
                    break
                case "debt_amount_repaid":
                    result.debtRepaidAmount = attribute.value
                    break
            }
         })

         return result
    }
    
    produceLiquidationTx(position: Position): LiquidationTx {

        throw new Error("Method not implemented.");
    }




}