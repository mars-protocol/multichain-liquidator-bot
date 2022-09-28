import { ExecuteResult, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { coin, Coin, DeliverTxResponse, logs } from '@cosmjs/stargate'
import { Attribute, Event } from '@cosmjs/stargate/build/logs'
import { LcdPool, OsmosisApiClient } from 'cosmology'
import { LiquidationResult, LiquidationTx } from './types/liquidation'
import { createLiquidationTx } from './liquidation_generator.js'

import { Position } from './types/position'
import { osmosis } from 'osmojs'
import { SwapAmountInRoute } from 'osmojs/types/proto/osmosis/gamm/v1beta1/tx'
import Long from 'long'

const { swapExactAmountIn } = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl

export interface ILiquidationHelper {
  // Produce the ts required to liquidate a position
  produceLiquidationTx(address: Position): LiquidationTx
  sendLiquidationsTx(txs: LiquidationTx[], coins: Coin[]): Promise<LiquidationResult[]>
  swap(
    assetInDenom: string,
    assetOutDenom: string,
    assetInAmount: number,
  ): Promise<DeliverTxResponse>
}

export class LiquidationHelper implements ILiquidationHelper {
  private client: SigningCosmWasmClient
  private liquidatorAddress: string
  private liquidationFilterContract: string

  constructor(
    client: SigningCosmWasmClient,
    liquidatorAddress: string,
    liquidationFilterContract: string,
  ) {
    this.client = client
    this.liquidatorAddress = liquidatorAddress
    this.liquidationFilterContract = liquidationFilterContract
  }

  // Find a pool Id where we can swap asset A with asset B.
  // TODO - this will only work for direct routes (i.e a pool of A:B or B:A), update to handle multihop
  async findRoute(denomA: string, denomB: string): Promise<SwapAmountInRoute[]> {
    const api = new OsmosisApiClient({ url: process.env.RPC_ENDPOINT! })

    // TODO: Consider extracting getPools to a helper method - only use for that library is here.
    const lcdPools = await api.getPools()

    let poolId = ''
    lcdPools.pools.forEach((pool: LcdPool) => {
      // stop once we find our pool
      if (poolId.length > 0) return

      const tokenA = pool.poolAssets[0].token
      const tokenB = pool.poolAssets[1].token
      if (
        tokenA.denom === denomA ||
        (tokenB.denom === denomA && tokenA.denom === denomB) ||
        tokenB.denom === denomB
      ) {
        poolId = pool.id
        console.log(`found pool with id ${poolId}`)
      }
    })

    // @ts-ignore
    // osmo.js uses a custom version of Long from external package with additional features which causes type error.
    // Will ignore for now as it should convert back to the osmo long just fine.
    return [{ poolId: Long.fromString(poolId), tokenOutDenom: denomB }]
  }

  /**
   * Create a msg to swap the collateral recieved to recover the asset we used to repay the debt.
   *
   * We return a msg instead of executing it, as this gives us the ability to easily change
   * whether we dispatch swaps in a batch, or one at a time.
   *
   * TODO make this chain agnostic
   *
   * @param assetInDenom  The asset we offer
   * @param assetOutDenom The asset we want to to recieve.
   * @param assetInAmount The amount we are offering
   *
   */
  async swap(
    assetInDenom: string,
    assetOutDenom: string,
    assetInAmount: number,
  ): Promise<DeliverTxResponse> {
    const route = await this.findRoute(assetInDenom, assetOutDenom)

    // create the message
    const msg = swapExactAmountIn({
      sender: this.liquidatorAddress,
      routes: route,
      tokenIn: coin(assetInAmount, assetInDenom),

      // TODO: Should we have a min amount here? It is very important the swap succeds, but at the same time
      // this makes us vulnerable to slippage / low liquidity / frontrunning etc
      tokenOutMinAmount: '1',
    })

    return await this.client.signAndBroadcast(this.liquidatorAddress, [msg], 'auto')
  }

  async sendLiquidationsTx(txs: LiquidationTx[], coins: Coin[]): Promise<LiquidationResult[]> {
    const msg = {
      liquidate_many: {
        liquidations: txs,
      },
    }

    const result = await this.client.execute(
      this.liquidatorAddress,
      this.liquidationFilterContract,
      msg,
      'auto',
      undefined,
      coins,
    )

    return this.parseLiquidationResult(result)
  }

  parseLiquidationResult(result: ExecuteResult): LiquidationResult[] {
    const liquidationResults: LiquidationResult[] = []

    console.log(result.logs[0].events)
    result.logs[0].events.forEach((e) => {
      if (e.type === 'wasm') {
        console.log(`found wasm`)
        const result = this.parseLiquidationResultInner(e)
        console.log(result)
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

    wasm.attributes.forEach((attribute: Attribute) => {
      console.log(attribute)
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
          console.log(result)
          console.log(results.length)
          break
      }
    })

    return results
  }

  produceLiquidationTx(position: Position): LiquidationTx {
    return createLiquidationTx(position)
  }
}
