import { LiquidationTx } from '../types/liquidation'
import { Position } from '../types/position'
import { toUtf8 } from '@cosmjs/encoding'
import { Coin, SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { EncodeObject } from '@cosmjs/proto-signing'

import { produceExecuteContractMessage, produceWithdrawMessage, sleep } from '../helpers'
import { cosmwasm } from 'osmojs'
import 'dotenv/config.js'

import BigNumber from 'bignumber.js'
import { BaseExecutor, BaseConfig } from '../BaseExecutor'
import { MsgExecuteContractEncodeObject } from '@cosmjs/cosmwasm-stargate'
import { getLargestCollateral, getLargestDebt } from '../liquidationGenerator'
import { Collateral, UserPositionData } from '../query/types.js'
import { Exchange } from '../exchange/ExchangeInterface.js'

import {
	calculateCollateralRatio,
	calculateLiquidationBonus,
	calculateMaxDebtRepayable,
	getLiquidationThresholdHealthFactor,
} from './LiquidationHelpers'
import { RouteRequester } from '../query/routing/RouteRequesterInterface'
import { ChainQuery } from '../query/chainQuery'

const { executeContract } = cosmwasm.wasm.v1.MessageComposer.withTypeUrl

export interface RedbankExecutorConfig extends BaseConfig {
	safetyMargin: number
	liquidationProfitMarginPercent: number
}

export const XYX_PRICE_SOURCE = 'xyk_liquidity_token'

/**
 * Executor class is the entry point for the executor service
 *
 * @param config The config defines the required contracts, endpoints and
 * 				 other parameters required
 * @param client A signing stargate client for dispatching transactions
 * @param queryClient A read only cosmwasm client for querying contracts
 */
export class RedbankExecutor extends BaseExecutor {
	private MINUTE = 1000 * 60
	public config: RedbankExecutorConfig
	private targetHealthFactor: number = 0
	private previousUnhealthyAccounts: Set<string> = new Set()

	constructor(
		config: RedbankExecutorConfig,
		client: SigningStargateClient,
		queryClient: ChainQuery,
		private exchangeInterface: Exchange,
		routeRequester: RouteRequester,
	) {
		super(config, client, queryClient, routeRequester)
		this.config = config
	}

	async start() {
		await this.updateAssetParams()
		await this.fetchTargetHealthFactor()
		await this.init()

		setInterval(this.updateAssetParams, 10 * this.MINUTE)
		setInterval(this.updatePriceSources, 10 * this.MINUTE)
		setInterval(this.updateOraclePrices, 1 * this.MINUTE)
		setInterval(this.fetchTargetHealthFactor, 10 * this.MINUTE)

		// run
		while (true) {
			try {
				await this.run()
			} catch (e) {
				console.error('ERROR:', e)
				// Record general error
				const labels = this.getMetricsLabels()
				const errorType = e instanceof Error ? e.constructor.name : 'UnknownError'
				this.metrics.recordLiquidationError(labels.chain, labels.sc_addr, labels.product, errorType)
			}
		}
	}

	async fetchTargetHealthFactor() {
		try {
			this.targetHealthFactor = await this.queryClient.queryContractSmart(
				{
					target_health_factor: {},
				},
				this.config.contracts.params,
			)
		} catch (e) {
			console.error(e)
		}
	}

	async produceLiquidationTx(positionData: UserPositionData): Promise<{
		tx: LiquidationTx
		debtToRepay: Coin
	}> {
		const txs: LiquidationTx[] = []
		const debtsToRepay = new Map<string, BigNumber>()

		let totalDebtValue = BigNumber(0)
		const availableValue = new BigNumber(
			this.balances.get(this.config.neutralAssetDenom) || 0,
		).multipliedBy(this.prices.get(this.config.neutralAssetDenom) || 0)
		if (availableValue.isZero()) {
			throw new Error('No neutral asset available')
		}

		if (positionData.collaterals.length > 0 && positionData.debts.length > 0) {
			// Build our params
			const largestCollateral = getLargestCollateral(positionData.collaterals, this.prices)
			const largestCollateralDenom = largestCollateral.denom
			const largestDebt = getLargestDebt(positionData.debts, this.prices)
			const debtDenom = largestDebt.denom
			const debtParams = this.assetParams.get(debtDenom)!
			const collateralParams = this.assetParams.get(largestCollateralDenom)!
			const debtPrice = this.prices.get(debtDenom)!
			const collateralPrice = this.prices.get(largestCollateralDenom)!

			const lbStart = Number(collateralParams.liquidation_bonus.starting_lb)
			const lbSlope = Number(collateralParams.liquidation_bonus.slope)
			const lbMax = Number(collateralParams.liquidation_bonus.max_lb)
			const lbMin = Number(collateralParams.liquidation_bonus.min_lb)
			const protocolLiquidationFee = Number(debtParams.protocol_liquidation_fee)

			const ltHealthFactor = getLiquidationThresholdHealthFactor(
				positionData.collaterals,
				positionData.debts,
				this.prices,
				this.assetParams,
			)

			const liquidationBonus = calculateLiquidationBonus(
				lbStart,
				lbSlope,
				ltHealthFactor,
				lbMax,
				lbMin,
				calculateCollateralRatio(
					positionData.debts,
					positionData.collaterals,
					this.prices,
				).toNumber(),
			)

			// max debt the protocol will allow us to repay
			const maxDebtRepayableValue = calculateMaxDebtRepayable(
				this.targetHealthFactor,
				positionData.debts,
				positionData.collaterals,
				this.assetParams,
				liquidationBonus,
				this.prices,
				largestCollateralDenom,
			)
			// Cap the repay amount by the collateral we are claiming. We need to factor in the liquidation bonus - as that comes out of the available collateral
			const largestCollateralValue = new BigNumber(largestCollateral.amount)
				.multipliedBy(1 - liquidationBonus)
				.multipliedBy(collateralPrice)

			// todo Make sure that the max repayable is less than the debt
			const maxRepayableValue = maxDebtRepayableValue.isGreaterThan(largestCollateralValue)
				? largestCollateralValue
				: maxDebtRepayableValue
			const maxRepayableAmount = maxRepayableValue.dividedBy(this.prices.get(debtDenom) || 0)

			// Neutral available to us for this specific liquidation
			const remainingNeutral = availableValue.minus(totalDebtValue)

			// Cap the repay amount by the remaining neutral asset we have
			const amountToRepay = remainingNeutral.isGreaterThan(maxRepayableValue)
				? maxRepayableAmount
				: remainingNeutral.multipliedBy(0.95).dividedBy(debtPrice)

			// If our debt is the same as our neutral, we skip this step
			const buyDebtRoute =
				this.config.neutralAssetDenom === debtDenom
					? []
					: this.ammRouter.getBestRouteGivenOutput(
							this.config.neutralAssetDenom,
							debtDenom,
							amountToRepay,
					  )

			console.log({
				amountToRepay: JSON.stringify(amountToRepay),
				buyDebtRoute: JSON.stringify(buyDebtRoute),
				maxDebtRepayableValue: JSON.stringify(maxDebtRepayableValue),
				maxRepayableAmount: JSON.stringify(maxRepayableAmount),
				maxRepayableValue: JSON.stringify(maxRepayableValue),
				remainingNeutral: JSON.stringify(remainingNeutral),
				neutralAssetDenom: this.config.neutralAssetDenom,
				debtDenom: debtDenom,
				debtPrice: debtPrice,
				collateralPrice: collateralPrice,
				liquidationBonus: liquidationBonus,
				protocolLiquidationFee: protocolLiquidationFee,
			})

			const liquidateTx = {
				collateral_denom: largestCollateralDenom,
				debt_denom: largestDebt.denom,
				user_address: positionData.address,
				amount: amountToRepay.multipliedBy(0.98).toFixed(0),
			}

			const newTotalDebt = totalDebtValue.plus(new BigNumber(amountToRepay).multipliedBy(debtPrice))

			txs.push(liquidateTx)

			// update debts + totals
			const existingDebt = debtsToRepay.get(liquidateTx.debt_denom) || 0
			debtsToRepay.set(liquidateTx.debt_denom, new BigNumber(amountToRepay).plus(existingDebt))
			totalDebtValue = newTotalDebt
			return {
				tx: liquidateTx,
				debtToRepay: {
					denom: liquidateTx.debt_denom,
					amount: amountToRepay.toFixed(0),
				},
			}
		}

		throw new Error('Missing collateral or debt for position')
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
					produceWithdrawMessage(liquidatorAddress, denom, this.config.contracts.redbank)
						.value as MsgExecuteContract,
				),
			)
		})

		return msgs
	}

	async appendSwapToNeutralMessages(
		coins: Coin[],
		liquidatorAddress: string,
		msgs: EncodeObject[],
	): Promise<BigNumber> {
		let expectedNeutralCoins = new BigNumber(0)
		coins = coins.filter((collateral) => collateral.denom !== this.config.neutralAssetDenom)

		for (const coin of coins) {
			let coinAmount =
				coin.denom === this.config.gasDenom
					? new BigNumber(coin.amount).minus(100000000) // keep min 100 tokens for gas
					: new BigNumber(coin.amount)

			if (coinAmount.multipliedBy(this.prices.get(coin.denom)!).isGreaterThan(10000)) {
				const routeResponse = await this.routeRequester.requestRoute(
					coin.denom,
					this.config.neutralAssetDenom,
					coin.amount,
				)

				let minOutput = coinAmount
					.multipliedBy(this.prices.get(coin.denom)!)
					.multipliedBy(0.985)
					.toFixed(0)

				if (minOutput === '0') {
					continue
				}

				expectedNeutralCoins = expectedNeutralCoins.plus(minOutput)

				msgs.push(
					this.exchangeInterface.produceSwapMessage(
						routeResponse.route,
						{ denom: coin.denom, amount: coinAmount.toFixed(0) },
						minOutput,
						liquidatorAddress,
					),
				)
			}
		}

		return expectedNeutralCoins
	}

	async appendSwapToDebtMessages(
		debtsToRepay: Coin[],
		liquidatorAddress: string,
		msgs: EncodeObject[],
		neutralAvailable: BigNumber,
		// min available stables?
	): Promise<Map<string, BigNumber>> {
		let remainingNeutral = neutralAvailable
		const expectedDebtAssetsPostSwap: Map<string, BigNumber> = new Map()

		for (const debt of debtsToRepay) {
			const debtAmountRequiredFromSwap = new BigNumber(debt.amount)
			if (debt.denom === this.config.neutralAssetDenom) {
				const cappedAmount = remainingNeutral.isLessThan(debt.amount)
					? remainingNeutral
					: new BigNumber(debt.amount)
				remainingNeutral = neutralAvailable.minus(cappedAmount.minus(1))

				const totalDebt = cappedAmount.plus(expectedDebtAssetsPostSwap.get(debt.denom) || 0)
				expectedDebtAssetsPostSwap.set(debt.denom, totalDebt)
			} else {
				let debtValue = debtAmountRequiredFromSwap
					.multipliedBy(this.prices.get(debt.denom) || 0)
					.multipliedBy(1.02)

				if (debtValue.gt(neutralAvailable)) {
					debtValue = neutralAvailable
				}

				const routeResponse = await this.routeRequester.requestRoute(
					this.config.neutralAssetDenom,
					debt.denom,
					debtValue.toFixed(0),
				)

				msgs.push(
					this.exchangeInterface.produceSwapMessage(
						routeResponse.route,
						{ denom: this.config.neutralAssetDenom, amount: debtValue.toFixed(0) },
						debtAmountRequiredFromSwap.toFixed(0),
						liquidatorAddress,
					),
				)
			}

			expectedDebtAssetsPostSwap.set(debt.denom, debtAmountRequiredFromSwap)
		}

		return expectedDebtAssetsPostSwap
	}

	executeViaRedbankMsg = (tx: LiquidationTx): MsgExecuteContractEncodeObject => {
		const msg = JSON.stringify({
			liquidate: { user: tx.user_address, collateral_denom: tx.collateral_denom },
		})

		return produceExecuteContractMessage(
			this.config.liquidatorMasterAddress,
			this.config.contracts.redbank,
			toUtf8(msg),
			[
				{
					amount: tx.amount,
					denom: tx.debt_denom,
				},
			],
		)
	}

	async run(): Promise<void> {
		const liquidatorAddress = this.config.liquidatorMasterAddress
		const labels = this.getMetricsLabels()
		const startTime = Date.now()

		// Reset per-loop (live) metrics
		this.metrics.resetLoopMetrics(labels)

		if (!this.queryClient || !this.signingClient)
			throw new Error("Instantiate your clients before calling 'run()'")

		await this.init()
		await this.setBalances(liquidatorAddress)

		const collateralsBefore: Collateral[] = await this.queryClient.queryRedbankCollaterals(
			liquidatorAddress,
		)
		await this.liquidateCollaterals(liquidatorAddress, collateralsBefore)

		let endpointPath =
			this.config.apiVersion === 'v1'
				? `v1/unhealthy_positions/${this.config.chainName}/${this.config.productName}`
				: `v2/unhealthy_positions?chain=${this.config.chainName}&product=${this.config.productName}`
		const url = `${this.config.marsEndpoint!}/${endpointPath}`
		const response = await fetch(url)
		let positionObjects: {
			account_id: string
			health_factor: string
			total_debt: string
		}[] = (await response.json())['data']

		let positions: Position[] = positionObjects
			.filter(
				(position) =>
					Number(position.health_factor) < Number(process.env.MAX_LIQUIDATION_LTV!) &&
					Number(position.health_factor) > Number(process.env.MIN_LIQUIDATION_LTV!) &&
					// position.account_id === "neutron1u44598z3a8fdy9e6cu7rpl2eqvl2shjvfg4sqd" &&
					position.total_debt.length > 5,
			)

			.sort((a, b) => Number(a.total_debt) - Number(b.total_debt))
			.map((positionObject) => {
				return {
					Identifier: positionObject.account_id,
				}
			})

		// Record unhealthy positions detected
		this.metrics.liquidationsUnhealthyPositionsDetectedTotal.inc(labels, positions.length)

		// --- Unhealthy to healthy logic ---
		const currentUnhealthy = new Set(positions.map((p) => p.Identifier))
		let unhealthyToHealthyCount = 0
		for (const prev of this.previousUnhealthyAccounts) {
			if (!currentUnhealthy.has(prev)) {
				unhealthyToHealthyCount++
			}
		}
		if (unhealthyToHealthyCount > 0) {
			this.metrics.incLoopUnhealthyToHealthy(labels, unhealthyToHealthyCount)
		}
		this.previousUnhealthyAccounts = currentUnhealthy

		if (positions.length == 0) {
			//sleep to avoid spamming redis db when empty
			await sleep(200)
			console.log(' - No items for liquidation yet')
			// Record duration even when no liquidations
			const duration = (Date.now() - startTime) / 1000
			this.metrics.liquidationsDurationSeconds.observe(labels, duration)
			return
		}

		const positionToLiquidate = positions[0]

		console.log(`- Liquidating ${positionToLiquidate.Identifier}`)
		
		// Record liquidation attempt
		this.metrics.recordLiquidationAttempt(labels.chain, labels.sc_addr, labels.product)
		
		// Fetch position data
		const liquidateeDebts = await this.queryClient.queryRedbankDebts(positionToLiquidate.Identifier)
		const liquidateeCollaterals = await this.queryClient.queryRedbankCollaterals(
			positionToLiquidate.Identifier,
		)

		try {
			const { tx, debtToRepay } = await this.produceLiquidationTx({
				address: positionToLiquidate.Identifier,
				debts: liquidateeDebts,
				collaterals: liquidateeCollaterals,
			})
			
			// Record debt amount being liquidated
			const debtValue = new BigNumber(debtToRepay.amount)
				.multipliedBy(this.prices.get(debtToRepay.denom) || 0)
			this.recordNotionalLiquidated(debtValue.toNumber())
			
			// deposit any neutral in our account before starting liquidations
			const firstMsgBatch: EncodeObject[] = []
			await this.appendSwapToDebtMessages(
				[debtToRepay],
				liquidatorAddress,
				firstMsgBatch,
				new BigNumber(this.balances.get(this.config.neutralAssetDenom)!),
			)

			// Preferably, we liquidate via redbank directly. This is so that if the liquidation fails,
			// the entire transaction fails and we do not swap.
			// When using the liquidation filterer contract, transactions with no successfull liquidations
			// will still succeed, meaning that we will still swap to the debt and have to swap back again.
			// If liquidating via redbank, unsucessfull liquidations will error, preventing the swap
			const execute: MsgExecuteContractEncodeObject = this.executeViaRedbankMsg(tx)
			firstMsgBatch.push(execute)

			const firstFee = await this.getFee(
				firstMsgBatch,
				this.config.liquidatorMasterAddress,
				this.config.chainName.toLowerCase(),
			)

			await this.signingClient.signAndBroadcast(this.config.liquidatorMasterAddress, firstMsgBatch, firstFee)

			// Record gas spent
			this.recordGasSpent(firstFee)

			console.log('Liquidation transaction broadcasted.')

			const collaterals: Collateral[] = await this.queryClient.queryRedbankCollaterals(
				liquidatorAddress,
			)

			await this.liquidateCollaterals(liquidatorAddress, collaterals)
			
			// Record successful liquidation
			this.metrics.recordLiquidationSuccess(labels.chain, labels.sc_addr, labels.product)
			this.metrics.incLoopSuccess(labels)

			console.log(`- Liquidation Process Complete.`)

			if (this.config.logResults) {
				this.writeCsv()
			}
		} catch (error) {
			// Record liquidation error
			const errorType = error instanceof Error ? error.constructor.name : 'UnknownError'
			this.metrics.recordLiquidationError(labels.chain, labels.sc_addr, labels.product, errorType)
			this.metrics.incLoopErrors(labels)
			console.error(`Liquidation failed: ${error}`)
			throw error
		} finally {
			// Always record duration
			const duration = (Date.now() - startTime) / 1000
			this.metrics.liquidationsDurationSeconds.observe(labels, duration)
		}
	}

	async liquidateCollaterals(liquidatorAddress: string, collaterals: Collateral[]) {
		let msgs: EncodeObject[] = []

		const balances = await this.signingClient?.getAllBalances(liquidatorAddress)

		const combinedCoins = this.combineBalances(collaterals, balances!).filter(
			(coin) =>
				this.prices.get(coin.denom) &&
				new BigNumber(coin.amount).multipliedBy(this.prices.get(coin.denom)!).gt(1000000),
		)

		if (combinedCoins.length === 0) return

		this.appendWithdrawMessages(collaterals, liquidatorAddress, msgs)
		await this.appendSwapToNeutralMessages(combinedCoins, liquidatorAddress, msgs)
		if (msgs.length === 0) return

		const secondFee = await this.getFee(
			msgs,
			this.config.liquidatorMasterAddress,
			this.config.chainName.toLowerCase(),
		)
		
		await this.signingClient.signAndBroadcast(this.config.liquidatorMasterAddress, msgs, secondFee)
		
		// Record gas spent for collateral liquidation
		this.recordGasSpent(secondFee)
		
		// Record stables won (neutral asset gained from swapping collaterals)
		const neutralBalance = await this.signingClient.getBalance(liquidatorAddress, this.config.neutralAssetDenom)
		if (neutralBalance) {
			this.recordStablesWon(Number(neutralBalance.amount))
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
}
