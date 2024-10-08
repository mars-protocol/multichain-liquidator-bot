import { LiquidationTx } from '../types/liquidation'
import { Position } from '../types/position'
import { toUtf8 } from '@cosmjs/encoding'
import { Coin, SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { EncodeObject } from '@cosmjs/proto-signing'

import { produceExecuteContractMessage, produceWithdrawMessage, sleep } from '../helpers'
import { cosmwasm } from 'osmojs'
import 'dotenv/config.js'
import { fetchRedbankBatch } from '../query/hive'

import BigNumber from 'bignumber.js'
import { BaseExecutor, BaseExecutorConfig } from '../BaseExecutor'
import { CosmWasmClient, MsgExecuteContractEncodeObject } from '@cosmjs/cosmwasm-stargate'
import { getLargestCollateral, getLargestDebt } from '../liquidationGenerator'
import { Collateral, DataResponse } from '../query/types.js'
import { PoolDataProvider } from '../query/amm/PoolDataProviderInterface'
import { Exchange } from '../execute/ExchangeInterface.js'

import { calculateCollateralRatio, calculateLiquidationBonus, calculateMaxDebtRepayable, getLiquidationThresholdHealthFactor } from './LiquidationHelpers'
import { RouteRequester } from '../query/routing/RouteRequesterInterface'
import { AssetParamsBaseForAddr } from 'marsjs-types/redbank/generated/mars-params/MarsParams.types'


const { executeContract } = cosmwasm.wasm.v1.MessageComposer.withTypeUrl

export interface RedbankExecutorConfig extends BaseExecutorConfig {
	liquidationFiltererAddress: string
	safetyMargin: number
	liquidationProfitMarginPercent: number
}

export const XYX_PRICE_SOURCE = "xyk_liquidity_token"

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
	private assetParams : Map<string, AssetParamsBaseForAddr> = new Map()
	private targetHealthFactor : number = 0

	constructor(
		config: RedbankExecutorConfig,
		client: SigningStargateClient,
		queryClient: CosmWasmClient,
		poolProvider: PoolDataProvider,
		private exchangeInterface: Exchange,
		routeRequester: RouteRequester
	) {
		super(config, client, queryClient, poolProvider, routeRequester)
		this.config = config
	}

	async start() {
		await this.fetchAssetParams()
		await this.fetchTargetHealthFactor()
		await this.refreshData()

		setInterval(this.fetchAssetParams, 10 * this.MINUTE)
		setInterval(this.updatePriceSources, 10 * this.MINUTE)
		setInterval(this.updateOraclePrices, 1 * this.MINUTE )
		setInterval(this.fetchTargetHealthFactor, 10 * this.MINUTE)

		// run
		while (true) {
			try {
				await this.run()
			} catch (e) {
				console.error('ERROR:', e)
			}
		}
	}

	async fetchTargetHealthFactor() {
		try {
			this.targetHealthFactor = await this.queryClient.queryContractSmart(this.config.marsParamsAddress, {
				target_health_factor: {}
			})
		} catch (e) {
			console.error(e)
		}
	}

	async fetchAssetParams() {
		const maxRetries = 5
		const limit = 5
	
		// while not returning empty, get all asset params
		let fetching = true
		let startAfter = ""
		let retries = 0
		while (fetching) {
			try {
				const response = await this.queryClient.queryContractSmart(this.config.marsParamsAddress, {
					all_asset_params: {
						limit,
						start_after: startAfter,
					  },
				})

				startAfter = response[response.length - 1] ? response[response.length - 1].denom : ""
				response.forEach((assetParam : AssetParamsBaseForAddr) => {
					this.assetParams.set(assetParam.denom, assetParam)
				})
				fetching = response.length === 5
				retries = 0
			} catch(ex) {
				console.warn(ex)
				retries++
				if (retries > maxRetries) {
					console.warn("Max retries exceeded, exiting", maxRetries)
					fetching = false
				} else {
					await sleep(5000)
					console.info("Retrying...")
				}
			}
		}
	}

	async produceLiquidationTxs(positionData: DataResponse[]): Promise<{
		txs: LiquidationTx[]
		debtsToRepay: Map<string, BigNumber>
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

		// create a list of debts that need to be liquidated
		for (const positionResponse of positionData) {
			const positionAddress = Object.keys(positionResponse.data)[0]
			const position = positionResponse.data[positionAddress]

			if (position.collaterals.length > 0 && position.debts.length > 0) {

				// Build our params
				const largestCollateral = getLargestCollateral(position.collaterals, this.prices)
				const largestCollateralDenom = largestCollateral.denom
				const largestDebt = getLargestDebt(position.debts, this.prices)
				const debtDenom = largestDebt.denom
				const debtParams = this.assetParams.get(debtDenom)
				const collateralParams = this.assetParams.get(largestCollateralDenom)
				const debtPrice = this.prices.get(debtDenom)
				const collateralPrice = this.prices.get(largestCollateralDenom)

				if (!debtParams || !debtPrice || !collateralPrice || !collateralParams) continue
				const lbStart = Number(collateralParams.liquidation_bonus.starting_lb)
				const lbSlope = Number(collateralParams.liquidation_bonus.slope)
				const lbMax = Number(collateralParams.liquidation_bonus.max_lb)
				const lbMin = Number(collateralParams.liquidation_bonus.min_lb)
				const protocolLiquidationFee = Number(debtParams.protocol_liquidation_fee)

				const ltHealthFactor = getLiquidationThresholdHealthFactor(
					position.collaterals,
					position.debts,
					this.prices,
					this.assetParams
				)

				const liquidationBonus = calculateLiquidationBonus(
					lbStart,
					lbSlope,
					ltHealthFactor,
					lbMax,
					lbMin,
					calculateCollateralRatio(
						position.debts,
						position.collaterals,
						this.prices
					).toNumber()
				)
				// Neutral available to us for this specific liquidation
				const remainingNeutral = availableValue.minus(totalDebtValue)

				// max debt the protocol will allow us to repay
				const maxDebtRepayableValue = calculateMaxDebtRepayable(
					this.targetHealthFactor,
					position.debts,
					position.collaterals,
					this.assetParams,
					liquidationBonus,
					this.prices,
					largestCollateralDenom
				)
				// Cap the repay amount by the collateral we are claiming. We need to factor in the liquidation bonus - as that comes out of the available collateral
				const largestCollateralValue = new BigNumber(largestCollateral.amount)
					.multipliedBy(1-liquidationBonus)
					.multipliedBy(collateralPrice)
				if (
					!largestCollateralValue ||
					largestCollateralValue.isLessThanOrEqualTo(10000) ||
					largestCollateralValue.isNaN()) continue

				// todo Make sure that the max repayable is less than the debt
				const maxRepayableValue = maxDebtRepayableValue.isGreaterThan(largestCollateralValue) ? largestCollateralValue : maxDebtRepayableValue
				const maxRepayableAmount = maxRepayableValue.dividedBy(this.prices.get(debtDenom) || 0)
				
				// Cap the repay amount by the remaining neutral asset we have
				const amountToRepay = remainingNeutral.isGreaterThan(maxRepayableValue)
					? maxRepayableAmount
					: (remainingNeutral.multipliedBy(0.95)).dividedBy(debtPrice)


				// If our debt is the same as our neutral, we skip this step
				const buyDebtRoute = this.config.neutralAssetDenom === debtDenom 
					? []
					: this.ammRouter.getBestRouteGivenOutput(
							this.config.neutralAssetDenom,
							debtDenom,
						amountToRepay,
					)

				console.log({
					amountToRepay: JSON.stringify(amountToRepay),
					buyDebtRoute : JSON.stringify(buyDebtRoute),
					maxDebtRepayableValue: JSON.stringify(maxDebtRepayableValue),
					maxRepayableAmount: JSON.stringify(maxRepayableAmount),
					maxRepayableValue : JSON.stringify(maxRepayableValue),
					remainingNeutral : JSON.stringify(remainingNeutral),
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
					user_address: positionAddress,
					amount: amountToRepay.multipliedBy(0.98).toFixed(0),
				}

				const newTotalDebt = totalDebtValue.plus(
					new BigNumber(amountToRepay).multipliedBy(debtPrice),
				)

				txs.push(liquidateTx)

				// update debts + totals
				const existingDebt = debtsToRepay.get(liquidateTx.debt_denom) || 0
				debtsToRepay.set(
					liquidateTx.debt_denom,
					new BigNumber(amountToRepay).plus(existingDebt),
				)
				totalDebtValue = newTotalDebt
			}
		}

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
					produceWithdrawMessage(liquidatorAddress, denom, this.config.redbankAddress)
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

					if (minOutput === "0") {
						continue
					}

					expectedNeutralCoins = expectedNeutralCoins.plus(minOutput)

					msgs.push(
						this.exchangeInterface.produceSwapMessage(
							routeResponse.route,
							{ denom: coin.denom, amount: coinAmount.toFixed(0) },
							minOutput,
							liquidatorAddress,
						)
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
				let debtValue = debtAmountRequiredFromSwap.multipliedBy(this.prices.get(debt.denom) || 0).multipliedBy(1.02)

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
					)
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

		return produceExecuteContractMessage(
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
		
		const collateralsBefore: Collateral[] = await this.queryClient?.queryContractSmart(
			this.config.redbankAddress,
			{ user_collaterals: { user: liquidatorAddress } },
		)

		await this.liquidateCollaterals(
			liquidatorAddress,
			collateralsBefore
		)

		const url = `${this.config.marsEndpoint!}/v1/unhealthy_positions/${this.config.chainName.toLowerCase()}/redbank`
		const response = await fetch(url);
		let positionObjects: {
			account_id: string,
			health_factor: string,
			total_debt: string
		}[] = (await response.json())['data']

		let positions: Position[] = positionObjects
			.filter(position =>
					Number(position.health_factor) < 0.97 &&
					Number(position.health_factor) > 0.3 &&
					// position.account_id === "neutron1u44598z3a8fdy9e6cu7rpl2eqvl2shjvfg4sqd" &&
					position.total_debt.length > 5)
					
			.sort((a, b) => Number(a.total_debt) - Number(b.total_debt))
			.map((positionObject) => {
				return {
					Identifier: positionObject.account_id,
				}
			})

		if (positions.length == 0) {
			//sleep to avoid spamming redis db when empty
			await sleep(200)
			console.log(' - No items for liquidation yet')
			return
		}

		for (const position of positions) {
			console.log(`- Liquidating ${position.Identifier}`)
			// Fetch position data
			const positionData: DataResponse[] = await fetchRedbankBatch(
				[position],
				this.config.redbankAddress,
				this.config.hiveEndpoint,
			)

			const { txs, debtsToRepay } = await this.produceLiquidationTxs(positionData)
			const debtCoins: Coin[] = []
			debtsToRepay.forEach((amount, denom) => debtCoins.push({ denom, amount: amount.toFixed(0) }))
			// deposit any neutral in our account before starting liquidations
			const firstMsgBatch: EncodeObject[] = []
			await this.appendSwapToDebtMessages(
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

			if (!firstMsgBatch || firstMsgBatch.length === 0 || txs.length === 0) continue

			const firstFee = await this.getFee(firstMsgBatch, this.config.liquidatorMasterAddress, this.config.chainName.toLowerCase())

			const result = await this.client.signAndBroadcast(
				this.config.liquidatorMasterAddress,
				firstMsgBatch,
				firstFee
			)

			console.log(`Liquidation hash: ${result.transactionHash}`)

			console.log(`- Successfully liquidated ${txs.length} positions`)

			const collaterals: Collateral[] = await this.queryClient?.queryContractSmart(
				this.config.redbankAddress,
				{ user_collaterals: { user: liquidatorAddress } },
			)

			await this.liquidateCollaterals(
				liquidatorAddress,
				collaterals
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
	}

	async liquidateCollaterals(liquidatorAddress: string, collaterals: Collateral[]) {
		let msgs: EncodeObject[] = []

		const balances = await this.client?.getAllBalances(liquidatorAddress)

		const combinedCoins = this.combineBalances(collaterals, balances!).filter(
			(coin) => this.prices.get(coin.denom) && 
						new BigNumber(coin.amount).multipliedBy(this.prices.get(coin.denom)!).gt(1000000)
		)

		if (combinedCoins.length === 0) return

		this.appendWithdrawMessages(collaterals, liquidatorAddress, msgs)
		await this.appendSwapToNeutralMessages(combinedCoins, liquidatorAddress, msgs)
		if (msgs.length === 0) return

		const secondFee = await this.getFee(msgs, this.config.liquidatorMasterAddress, this.config.chainName.toLowerCase())
		await this.client.signAndBroadcast(
			this.config.liquidatorMasterAddress,
			msgs,
			secondFee,
		)
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
