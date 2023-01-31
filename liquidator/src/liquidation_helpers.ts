import { Attribute } from '@cosmjs/stargate'
import { LiquidationResult } from './types/liquidation.js'

export class LiquidationHelper {
  private liquidatorAddress: string
  private liquidationFilterContract: string

  constructor(liquidatorAddress: string, liquidationFilterContract: string) {
    this.liquidatorAddress = liquidatorAddress
    this.liquidationFilterContract = liquidationFilterContract
  }

  getLiquidatorAddress(): string {
    return this.liquidatorAddress
  }

  parseLiquidationResult(events: Event[]): LiquidationResult[] {
    const liquidationResults: LiquidationResult[] = []

    events.forEach((e) => {
      if (e.type === 'wasm') {
        const result = this.parseLiquidationResultInner(e)
        liquidationResults.push.apply(liquidationResults, result)
      }
    })

    return liquidationResults
  }

  parseLiquidationResultInner(wasm: Event): LiquidationResult[] {
    const results: LiquidationResult[] = []

    let result: LiquidationResult = {
      collateralReceivedDenom: '',
      debtRepaidDenom: '',
      debtRepaidAmount: '',
      collateralReceivedAmount: '',
    }

    console.log(wasm)
    //@ts-ignore
    wasm.attributes.forEach((attribute: Attribute) => {
      // find all parameters we require
      switch (attribute.key) {
        case 'collateral_denom':
          result.collateralReceivedDenom = attribute.value
          break
        case 'debt_denom':
          result.debtRepaidDenom = attribute.value
          break
        case 'collateral_amount':
          result.collateralReceivedAmount = attribute.value
          break
        case 'debt_amount':
          result.debtRepaidAmount = attribute.value

          // Debt amount repaid is the last KV pair we index, so we push and make blank
          results.push({ ...result })
          result = {
            collateralReceivedDenom: '',
            debtRepaidDenom: '',
            debtRepaidAmount: '',
            collateralReceivedAmount: '',
          }
          break
      }
    })

    return results
  }

  getLiquidationFiltererContract(): string {
    return this.liquidationFilterContract
  }
}
