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
import { PoolDataProviderInterface } from '../query/amm/PoolDataProviderInterface'
import { ExchangeInterface } from '../execute/ExchangeInterface.js'
import { AssetParamsBaseForAddr } from '../types/marsParams.js'
import { OsmosisPriceSourceForString } from '../types/marsOracleOsmosis.types'
import { OsmosisOraclePriceFetcher as MarsOraclePriceFetcher } from '../query/oracle/OsmosisOraclePriceFetcher'
import { PythPriceFetcher } from '../query/oracle/PythPriceFetcher'
import { WasmPriceSourceForString } from '../types/marsOracleWasm.types'
import { OraclePrice } from '../query/oracle/PriceFetcherInterface'
import { calculateCollateralRatio, calculateLiquidationBonus, calculateMaxDebtRepayable, getLiquidationThresholdHealthFactor } from './LiquidationHelpers'


const { executeContract } = cosmwasm.wasm.v1.MessageComposer.withTypeUrl

export interface RedbankExecutorConfig extends BaseExecutorConfig {
	liquidationFiltererAddress: string
	liquidatableAssets: string[]
	safetyMargin: number
	liquidationProfitMarginPercent: number
}

export interface PriceSourceResponse {
	denom: string,
	price_source: OsmosisPriceSourceForString | WasmPriceSourceForString
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

	private priceSources : PriceSourceResponse[] = []
	private oraclePrices : Map<string, BigNumber> = new Map()

	private marsOraclePriceFetcher : MarsOraclePriceFetcher = new MarsOraclePriceFetcher(this.queryClient)
	private pythOraclePriceFetcher : PythPriceFetcher = new PythPriceFetcher()

	constructor(
		config: RedbankExecutorConfig,
		client: SigningStargateClient,
		queryClient: CosmWasmClient,
		poolProvider: PoolDataProviderInterface,
		private exchangeInterface: ExchangeInterface
	) {
		super(config, client, queryClient, poolProvider)
		this.config = config
	}

	async start() {
		await this.initiateAstroportPoolProvider()
		await this.updatePriceSources()
		await this.updateOraclePrices()
		await this.fetchAssetParams()
		await this.fetchTargetHealthFactor()


		setInterval(this.fetchAssetParams, 10 * this.MINUTE)
		setInterval(this.updatePriceSources, 10 * this.MINUTE)
		setInterval(this.updateOraclePrices, 1 * this.MINUTE )
		setInterval(this.fetchTargetHealthFactor, 10 * this.MINUTE)

		if (this.config.chainName === "neutron") {
			await this.initiateAstroportPoolProvider()
		}
		
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

	updatePriceSources = async () => {
		let priceSources : PriceSourceResponse[] = []
		let fetching = true
		let start_after = ""
		let retries = 0

		const maxRetries = 5
		const limit = 10

		while (fetching) {
			try {
				const response = await this.queryClient.queryContractSmart(this.config.oracleAddress, {
					price_sources: {
						limit,
						start_after,
					},
				})
				start_after = response[response.length - 1] ? response[response.length - 1].denom : ""
				priceSources = priceSources.concat(response)
				fetching = response.length === limit
				retries = 0
			} catch(e) {
				console.warn(e)
				retries++
				if (retries >= maxRetries) {
					console.warn("Max retries exceeded, exiting", maxRetries)
					fetching = false
				} else {
					await sleep(5000)
					console.info("Retrying...")
				}
			}
		}

		// don't override if we did not fetch all data.
		if (retries < maxRetries) {
			this.priceSources = priceSources
		}
	}

	updateOraclePrices = async () => {
		try {
			// settle all price sources
			const priceResults : PromiseSettledResult<OraclePrice>[] = await Promise.allSettled(this.priceSources.map(async (priceSource) => await this.fetchOraclePrice(priceSource.denom)))

			priceResults.forEach((oraclePriceResult) => {
				const successfull = oraclePriceResult.status === 'fulfilled'
				const oraclePrice = successfull ? oraclePriceResult.value : null

				// push successfull price results
				if (successfull && oraclePrice) {
					this.oraclePrices.set(oraclePrice.denom, oraclePrice.price)
				}
			})
		} catch (e) {
			console.error(e)
		}
	}

	private fetchOraclePrice = async (denom: string) : Promise<OraclePrice> => {
		const priceSource : PriceSourceResponse | undefined = this.priceSources.find(ps => ps.denom === denom)
		if (!priceSource) {
			console.error(`No price source found for ${denom}`)
		}

		switch (priceSource?.[Object.keys(priceSource)[0]]) {
			case 'fixed':
			case 'spot':
				// todo - support via pool query. But is this ever used? 
			case 'arithmetic_twap':
			case 'geometric_twap':
			case 'xyk_liquidity_token':
			case 'lsd':
			case 'staked_geometric_twap':
				return await this.marsOraclePriceFetcher.fetchPrice({
					oracleAddress: this.config.oracleAddress,
					priceDenom: denom
				})
			case 'pyth':

				const pyth : {
					price_feed_id: string,
					denom_decimals : number
				//@ts-expect-error - our generated types don't handle this case
				} =  priceSource.price_source.pyth
				
				return await this.pythOraclePriceFetcher.fetchPrice({
					priceFeedId:pyth.price_feed_id,
					denomDecimals: pyth.denom_decimals,
					denom: denom
				})
			  // Handle other cases for different price source types	  
			default:
				// Handle unknown or unsupported price source types
				return await this.marsOraclePriceFetcher.fetchPrice({
					oracleAddress: this.config.oracleAddress,
					priceDenom: denom
				})
			// iterate, fetch price source correctly
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

				const neutralToSell = this.ammRouter.getRequiredInput(
					amountToRepay,
					buyDebtRoute
				)

				const valueToRepay = amountToRepay.multipliedBy(debtPrice)

				// calculate how much collateral we get back
				const collateralValueToBeWon = (new BigNumber(valueToRepay).multipliedBy(
					1 + liquidationBonus)).multipliedBy(1-protocolLiquidationFee)

				const collateralAmountToBeWon = collateralValueToBeWon.dividedBy(collateralPrice)
				const collateralToNeutralRoute = this.ammRouter.getBestRouteGivenInput(
					largestCollateralDenom,
					this.config.neutralAssetDenom,
					collateralAmountToBeWon
				)

				const neutralWon = this.ammRouter.getOutput(
					collateralAmountToBeWon,
					collateralToNeutralRoute
				)

				const neutralAssetRepaid = neutralToSell.gt(0) ? neutralToSell : amountToRepay
				const amountWon = neutralWon.minus(neutralAssetRepaid)

				// This is displayed as a fraction, not a percentage - for instance 3% will be 0.03
				const winningPercentage = amountWon.dividedBy(valueToRepay)

				console.log({
					winningPercentage: JSON.stringify(winningPercentage), 
					neutralWon : JSON.stringify(neutralWon)})
				// if (winningPercentage.isGreaterThan(this.config.liquidationProfitMarginPercent)) { 
					// profitable to liquidate this position
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
				// }
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
							const result = routeAReturns.minus(routeBReturns).toNumber()
							return result
						})
						.filter((route) => this.ammRouter.getOutput(collateralAmount, route).isGreaterThan(100000))
						.pop()


					if (bestRoute) {
						// allow for 2.5% slippage from what we estimated
						const minOutput = this.ammRouter
							.getOutput(new BigNumber(collateralAmount), bestRoute)
							.multipliedBy(0.975)
							.toFixed(0)

						expectedNeutralCoins = expectedNeutralCoins.plus(minOutput)

						msgs.push(
							this.exchangeInterface.produceSwapMessage(
								bestRoute,
								{ denom: collateral.denom, amount: collateralAmount.toFixed(0) },
								minOutput,
								liquidatorAddress,
							)
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
				const debtValue = debtAmountRequiredFromSwap.multipliedBy(this.prices.get(debt.denom) || 0).multipliedBy(1.02)

				const bestRoute = this.ammRouter.getBestRouteGivenInput(
					this.config.neutralAssetDenom,
					debt.denom,
					debtValue
				)

				if (bestRoute) {

					msgs.push(
						this.exchangeInterface.produceSwapMessage(
							bestRoute,
							{ denom: this.config.neutralAssetDenom, amount: debtValue.toFixed(0) },
							debtAmountRequiredFromSwap.multipliedBy(0.95).toFixed(0),
							liquidatorAddress,
						)
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
		console.log(JSON.stringify(collateralsBefore))
		if (collateralsBefore.length > 0) {
			await this.liquidateCollaterals(
				liquidatorAddress,
				collateralsBefore
			)
		}
		console.log('Checking for liquidations')
		const url = `${this.config.marsEndpoint!}/v1/unhealthy_positions/${this.config.chainName.toLowerCase()}/redbank`
		const response = await fetch(url);
		let positionObjects: {
			account_id: string,
			health_factor: string,
			total_debt: string
		}[] = (await response.json())['positions']

		let positions: Position[] = positionObjects
			.filter(position =>
					Number(position.health_factor) < 0.97 &&
					Number(position.health_factor) > 0.3 &&
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

		// TODO: support multiple liquidations like we do with rover
		positions = [positions.pop()!]

		console.log(JSON.stringify(positions))

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

		const firstFee = this.config.chainName.toLowerCase() === "osmosis" ? await this.getOsmosisFee(firstMsgBatch, this.config.liquidatorMasterAddress) : 'auto'

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

	async liquidateCollaterals(liquidatorAddress: string, collaterals: Collateral[]) {
		let secondBatch: EncodeObject[] = []

		const balances = await this.client?.getAllBalances(liquidatorAddress)

		const combinedCoins = this.combineBalances(collaterals, balances!)

		this.appendWithdrawMessages(collaterals, liquidatorAddress, secondBatch)

		this.appendSwapToNeutralMessages(combinedCoins, liquidatorAddress, secondBatch)
		const secondFee = this.config.chainName.toLowerCase() === "osmosis" 
			? await this.getOsmosisFee(secondBatch, this.config.liquidatorMasterAddress)
			: 'auto'

		await this.client.signAndBroadcast(
			this.config.liquidatorMasterAddress,
			secondBatch,
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
