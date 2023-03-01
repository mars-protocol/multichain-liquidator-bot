import { LiquidationTx } from '../types/liquidation.js'
import { Position } from '../types/position'
import { toUtf8 } from '@cosmjs/encoding'
import { Coin, SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { coins, EncodeObject } from '@cosmjs/proto-signing'

import { makeExecuteContractMessage, makeWithdrawMessage, sleep } from '../helpers'
import { osmosis, cosmwasm } from 'osmojs'

import 'dotenv/config.js'
import { fetchRedbankBatch } from '../query/hive'

import BigNumber from 'bignumber.js'
import { Long } from 'osmojs/types/codegen/helpers.js'
import { BaseExecutor, BaseExecutorConfig } from '../BaseExecutor'
import { CosmWasmClient, MsgExecuteContractEncodeObject } from '@cosmjs/cosmwasm-stargate'
import { getLargestCollateral, getLargestDebt } from '../liquidationGenerator'
import { Collateral, DataResponse } from '../query/types.js'

const { swapExactAmountIn } = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl

const { executeContract } = cosmwasm.wasm.v1.MessageComposer.withTypeUrl

export interface RedbankExecutorConfig extends BaseExecutorConfig {
	liquidationFiltererAddress: string
	liquidatableAssets: string[]
	safetyMargin: number
}

/**
 * Executor class is the entry point for the executor service
 *
 * @param config The config defines the required contracts, endpoints and
 * 				 other parameters required
 * @param client A signing stargate client for dispatching transactions
 * @param queryClient A read only cosmwasm client for querying contracts
 */
export class RedbankExecutor extends BaseExecutor {
	public config: RedbankExecutorConfig

	constructor(
		config: RedbankExecutorConfig,
		client: SigningStargateClient,
		queryClient: CosmWasmClient,
	) {
		super(config, client, queryClient)
		this.config = config
	}

	async start() {
		await this.initiate()

		// run
		while (true) {
			try {
				await this.run()
			} catch (e) {
				console.log('ERROR:', e)
			}
		}
	}

	produceLiquidationTxs(positionData: DataResponse[]): {
		txs: LiquidationTx[]
		debtsToRepay: Map<string, BigNumber>
	} {
		const txs: LiquidationTx[] = []
		const debtsToRepay = new Map<string, BigNumber>()

		let totalDebtValue = BigNumber(0)
		const availableValue = new BigNumber(
			this.balances.get(this.config.neutralAssetDenom) || 0,
		).multipliedBy(this.prices.get(this.config.neutralAssetDenom) || 0)

		// create a list of debts that need to be liquidated
		positionData.forEach(async (positionResponse: DataResponse) => {
			const positionAddress = Object.keys(positionResponse.data)[0]
			const position = positionResponse.data[positionAddress]

			if (position.collaterals.length > 0 && position.debts.length > 0) {
				const largestCollateralDenom = getLargestCollateral(position.collaterals, this.prices)
				const largestDebt = getLargestDebt(position.debts, this.prices)

				// total debt value is calculated in base denom (i.e uosmo).
				// We scale down to ensure we have space for slippage etc in the swap
				// transactions that follow
				const remainingAvailableSize = availableValue
					.multipliedBy(1 - this.config.safetyMargin)
					.minus(totalDebtValue)

				if (remainingAvailableSize.isGreaterThan(1000)) {
					// we will always have a value here as we filter for the largest above
					const debtPrice = this.prices.get(largestDebt.denom)!
					const debtValue = new BigNumber(largestDebt.amount).multipliedBy(debtPrice)

					// Note -amount here is the number of the asset, not the value.
					const amountToLiquidate = remainingAvailableSize.isGreaterThan(debtValue)
						? new BigNumber(largestDebt.amount)
						: remainingAvailableSize.dividedBy(debtPrice)

					const liquidateTx = {
						collateral_denom: largestCollateralDenom,
						debt_denom: largestDebt.denom,
						user_address: positionAddress,
						amount: amountToLiquidate.toFixed(0),
					}

					const newTotalDebt = totalDebtValue.plus(
						new BigNumber(amountToLiquidate).multipliedBy(debtPrice),
					)
					txs.push(liquidateTx)

					// update debts + totals
					const existingDebt = debtsToRepay.get(liquidateTx.debt_denom) || 0
					debtsToRepay.set(
						liquidateTx.debt_denom,
						new BigNumber(amountToLiquidate).plus(existingDebt),
					)
					totalDebtValue = newTotalDebt
				} else {
					console.warn(
						`WARNING - not enough size to liquidate this position - user address : ${[
							positionAddress,
						]}`,
					)
				}
			}
		})

		return { txs, debtsToRepay }
	}

	appendWithdrawMessages(
		collateralsWon: Collateral[],
		liquidatorAddress: string,
		msgs: EncodeObject[],
	): EncodeObject[] {
		// for each asset, create a withdraw message
		collateralsWon.forEach((collateral) => {
			const denom = collateral.denom
			msgs.push(
				executeContract(
					makeWithdrawMessage(liquidatorAddress, denom, this.config.redbankAddress)
						.value as MsgExecuteContract,
				),
			)
		})

		return msgs
	}

	appendSwapToNeutralMessages(
		coins: Coin[],
		liquidatorAddress: string,
		msgs: EncodeObject[],
	): BigNumber {
		let expectedNeutralCoins = new BigNumber(0)
		coins
			.filter((collateral) => collateral.denom !== this.config.neutralAssetDenom)
			.forEach((collateral) => {
				let collateralAmount =
					collateral.denom === this.config.gasDenom
						? new BigNumber(collateral.amount).minus(100000000) // keep min 100 tokens for gas
						: new BigNumber(collateral.amount)

				if (collateralAmount.isGreaterThan(1000) && !collateralAmount.isNaN()) {
					const routeOptions = this.ammRouter.getRoutes(
						collateral.denom,
						this.config.neutralAssetDenom,
					)

					const bestRoute = routeOptions
						.sort((routeA, routeB) => {
							const routeAReturns = this.ammRouter.getOutput(collateralAmount, routeA)
							const routeBReturns = this.ammRouter.getOutput(collateralAmount, routeB)
							return routeAReturns.minus(routeBReturns).toNumber()
						})
						.pop()

					if (bestRoute) {
						// allow for 2.5% slippage from what we estimated
						const minOutput = this.ammRouter
							.getOutput(new BigNumber(collateralAmount), bestRoute)
							.multipliedBy(0.975)
							.toFixed(0)

						expectedNeutralCoins = expectedNeutralCoins.plus(minOutput)
						msgs.push(
							swapExactAmountIn({
								sender: liquidatorAddress,
								// cast to long because osmosis felt it neccessary to create their own Long rather than use the js one
								routes: bestRoute?.map((route) => {
									return { poolId: route.poolId as Long, tokenOutDenom: route.tokenOutDenom }
								}),
								tokenIn: { denom: collateral.denom, amount: Number(collateralAmount).toFixed(0) },
								tokenOutMinAmount: minOutput,
							}),
						)
					}
				}
			})

		return expectedNeutralCoins
	}

	appendSwapToDebtMessages(
		debtsToRepay: Coin[],
		liquidatorAddress: string,
		msgs: EncodeObject[],
		neutralAvailable: BigNumber,
		// min available stables?
	): Map<string, BigNumber> {
		let remainingNeutral = neutralAvailable
		const expectedDebtAssetsPostSwap: Map<string, BigNumber> = new Map()

		debtsToRepay.forEach((debt) => {
			const debtAmountRequiredFromSwap = new BigNumber(debt.amount)

			if (debt.denom === this.config.neutralAssetDenom) {
				const cappedAmount = remainingNeutral.isLessThan(debt.amount)
					? remainingNeutral
					: new BigNumber(debt.amount)
				remainingNeutral = neutralAvailable.minus(cappedAmount.minus(1))

				const totalDebt = cappedAmount.plus(expectedDebtAssetsPostSwap.get(debt.denom) || 0)
				expectedDebtAssetsPostSwap.set(debt.denom, totalDebt)
			} else {
				const bestRoute = this.ammRouter.getBestRouteGivenOutput(
					this.config.neutralAssetDenom,
					debt.denom,
					debtAmountRequiredFromSwap,
				)
				if (bestRoute) {
					const amountToSwap = this.ammRouter.getRequiredInput(
						// we add a little more to ensure we get enough to cover debt
						debtAmountRequiredFromSwap.multipliedBy(1.02),
						bestRoute,
					)

					msgs.push(
						swapExactAmountIn({
							sender: liquidatorAddress,
							routes: bestRoute?.map((route) => {
								return { poolId: route.poolId as Long, tokenOutDenom: route.tokenOutDenom }
							}),
							tokenIn: { denom: this.config.neutralAssetDenom, amount: amountToSwap.toFixed(0) },
							// allow for 1% slippage for debt what we estimated
							tokenOutMinAmount: debtAmountRequiredFromSwap.toFixed(0),
						}),
					)
				}
			}
		})

		return expectedDebtAssetsPostSwap
	}

	executeViaRedbankMsg = (tx: LiquidationTx): MsgExecuteContractEncodeObject => {
		const msg = JSON.stringify({
			liquidate: { user: tx.user_address, collateral_denom: tx.collateral_denom },
		})

		return makeExecuteContractMessage(
			this.config.liquidatorMasterAddress,
			this.config.redbankAddress,
			toUtf8(msg),
			[
				{
					amount: tx.amount,
					denom: tx.debt_denom,
				},
			],
		)
	}

	executeViaFilterer = (
		txs: LiquidationTx[],
		debtCoins: Coin[],
	): MsgExecuteContractEncodeObject => {

		const msg = toUtf8(JSON.stringify({ liquidate_many: { liquidations: txs } }))

		return makeExecuteContractMessage(
			this.config.liquidatorMasterAddress,
			this.config.liquidationFiltererAddress,
			msg,
			debtCoins,
		)
	}

	async run(): Promise<void> {
		const liquidatorAddress = this.config.liquidatorMasterAddress

		if (!this.queryClient || !this.client)
			throw new Error("Instantiate your clients before calling 'run()'")

		await this.refreshData()

		console.log('Checking for liquidations')
		const positions: Position[] = await this.redis.popUnhealthyRedbankPositions(25)

		if (positions.length == 0) {
			//sleep to avoid spamming redis db when empty
			await sleep(200)
			console.log(' - No items for liquidation yet')
			return
		}

		// Fetch position data
		const positionData: DataResponse[] = await fetchRedbankBatch(
			positions,
			this.config.redbankAddress,
			this.config.hiveEndpoint,
		)

		console.log(`- found ${positionData.length} positions queued for liquidation.`)

		const { txs, debtsToRepay } = this.produceLiquidationTxs(positionData)

		const debtCoins: Coin[] = []
		debtsToRepay.forEach((amount, denom) => debtCoins.push({ denom, amount: amount.toFixed(0) }))

		// deposit any neutral in our account before starting liquidations
		const firstMsgBatch: EncodeObject[] = []
		this.appendSwapToDebtMessages(
			debtCoins,
			liquidatorAddress,
			firstMsgBatch,
			new BigNumber(this.balances.get(this.config.neutralAssetDenom)!),
		)

		// Preferably, we liquidate via redbank directly. This is so that if the liquidation fails,
		// the entire transaction fails and we do not swap.
		// When using the liquidation filterer contract, transactions with no successfull liquidations
		// will still succeed, meaning that we will still swap to the debt and have to swap back again.
		// If liquidating via redbank, unsucessfull liquidations will error, preventing the swap

		const execute: MsgExecuteContractEncodeObject =
			// index [0] is safe as we know the length is 1 from the conditional
			txs.length == 1 ? this.executeViaRedbankMsg(txs[0]) : this.executeViaFilterer(txs, debtCoins)
			
		firstMsgBatch.push(execute)

		if (!firstMsgBatch || firstMsgBatch.length === 0 || txs.length === 0) return

		const result = await this.client.signAndBroadcast(
			this.config.liquidatorMasterAddress,
			firstMsgBatch,
			await this.getFee(firstMsgBatch, this.config.liquidatorMasterAddress),
		)

		this.redis.incrementBy('executor.liquidations.executed', txs.length)

		console.log(`- Successfully liquidated ${txs.length} positions`)

		const collaterals: Collateral[] = await this.queryClient?.queryContractSmart(
			this.config.redbankAddress,
			{ user_collaterals: { user: liquidatorAddress } },
		)

		// second block of transactions
		let secondBatch: EncodeObject[] = []

		const balances = await this.client?.getAllBalances(liquidatorAddress)

		const combinedCoins = this.combineBalances(collaterals, balances!)

		this.appendWithdrawMessages(collaterals, liquidatorAddress, secondBatch)

		this.appendSwapToNeutralMessages(combinedCoins, liquidatorAddress, secondBatch)

		await this.client.signAndBroadcast(
			this.config.liquidatorMasterAddress,
			secondBatch,
			await this.getFee(secondBatch, this.config.liquidatorMasterAddress),
		)

		await this.setBalances(liquidatorAddress)

		if (this.config.logResults) {
			txs.forEach((tx) => {
				this.addCsvRow({
					blockHeight: result.height,
					collateral: tx.collateral_denom,
					debtRepaid: tx.debt_denom,
					estimatedLtv: '0',
					userAddress: tx.user_address,
					liquidatorBalance: Number(this.balances.get(this.config.neutralAssetDenom) || 0),
				})
			})
		}

		console.log(`- Liquidation Process Complete.`)

		if (this.config.logResults) {
			this.writeCsv()
		}
	}

	combineBalances(collaterals: Collateral[], balances: readonly Coin[]): Coin[] {
		const coinMap: Map<string, Coin> = new Map()

		collaterals.forEach((collateral) =>
			coinMap.set(collateral.denom, {
				denom: collateral.denom,
				amount: Number(collateral.amount).toFixed(0),
			}),
		)

		balances.forEach((balance) => {
			const denom = balance.denom
			const amount = balance.amount
			const existingBalance = coinMap.get(denom)?.amount || 0
			const newBalance = (Number(existingBalance) + Number(amount)).toFixed(0)
			const newCoin = { denom, amount: newBalance }
			coinMap.set(denom, newCoin)
		})

		const result: Coin[] = []
		coinMap.forEach((coin) => result.push(coin))
		return result
	}

	getFee = async (msgs: EncodeObject[], address: string) => {
		if (!this.client)
			throw new Error(
				'Stargate Client is undefined, ensure you call initiate at before calling this method',
			)
		const gasEstimated = await this.client.simulate(address, msgs, '')
		const fee = {
			amount: coins(60000, 'uosmo'),
			gas: Number(gasEstimated * 1.3).toFixed(0),
		}

		return fee
	}
}
