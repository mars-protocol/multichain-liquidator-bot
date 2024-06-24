import { LiquidationTx } from '../types/liquidation.js'
import { toUtf8 } from '@cosmjs/encoding'
import { Coin, SigningStargateClient } from '@cosmjs/stargate'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js'
import { coins, EncodeObject } from '@cosmjs/proto-signing'
import { produceExecuteContractMessage, produceWithdrawMessage, sleep } from '../helpers'
import { cosmwasm } from 'osmojs'
import 'dotenv/config.js'
import { fetchRedbankBatch } from '../query/hive'
import BigNumber from 'bignumber.js'
import { BaseExecutor, BaseExecutorConfig } from '../BaseExecutor'
import { CosmWasmClient, MsgExecuteContractEncodeObject } from '@cosmjs/cosmwasm-stargate'
import { getLargestCollateral, getLargestDebt } from '../liquidationGenerator'
import { Collateral, DataResponse } from '../query/types.js'
import { PoolDataProviderInterface } from '../query/amm/PoolDataProviderInterface.js'
import { ExchangeInterface } from '../execute/ExchangeInterface.js'
import { RouteRequesterInterface } from '../query/amm/RouteRequesterInterface.js'

const { executeContract } = cosmwasm.wasm.v1.MessageComposer.withTypeUrl

export interface RedbankExecutorConfig extends BaseExecutorConfig {
	liquidationFiltererAddress: string
	liquidatableAssets: string[]
	safetyMargin: number
	astroportApi: string
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
		poolProvider: PoolDataProviderInterface,
		private exchangeInterface: ExchangeInterface,
		private routeRequestApi: RouteRequesterInterface,
	) {
		super(config, client, queryClient, poolProvider)
		console.log({config})
		this.config = config
	}

	async start() {
		await this.refreshData()
		
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
		)

		// create a list of debts that need to be liquidated
		positionData.forEach(async (positionResponse: DataResponse) => {
			const positionAddress = Object.keys(positionResponse.data)[0]
			const position = positionResponse.data[positionAddress]

			if (position.collaterals.length > 0 && position.debts.length > 0) {
				const largestCollateralDenom = getLargestCollateral(position.collaterals, this.prices)
				const largestDebt = getLargestDebt(position.debts, this.prices)
				// total debt value is calculated in base denom (i.e uosmo, usdc).
				// We scale down to ensure we have space for slippage etc in the swap
				// transactions that follow
				if (availableValue.isGreaterThan(1000)) {
					// we will always have a value here as we filter for the largest above
					const debtPrice = this.prices.get(largestDebt.denom)!
					const debtValue = new BigNumber(largestDebt.amount).multipliedBy(debtPrice)

					// Note -amount here is the number of the asset, not the value.
					const amountToLiquidate = availableValue.isGreaterThan(debtValue)
						? new BigNumber(largestDebt.amount)
						: availableValue.dividedBy(debtPrice).multipliedBy(0.95)

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
					produceWithdrawMessage(liquidatorAddress, denom, this.config.redbankAddress)
						.value as MsgExecuteContract,
				),
			)
		})

		return msgs
	}

	async appendSwapToNeutralMessages(
		collaterals: Coin[],
		liquidatorAddress: string,
		msgs: EncodeObject[],
	): Promise<BigNumber> {
		let expectedNeutralCoinAmount = new BigNumber(0)
		for (const collateral of collaterals) {
			if (collateral.denom === this.config.neutralAssetDenom)
				continue

			let collateralAmount =
				collateral.denom === this.config.gasDenom
					? new BigNumber(collateral.amount).minus(100000000) // keep min 100 tokens for gas
					: new BigNumber(collateral.amount)
			if (collateralAmount.isGreaterThan(1000) && !collateralAmount.isNaN()) {
				let {
					route,
					expectedOutput,
				} = await this.routeRequestApi.requestRoute(
					"https://app.astroport.fi/api/",
					collateral.denom,
					this.config.neutralAssetDenom,
					collateralAmount.toFixed(0),
				)

				// allow for 2.5% slippage from what we estimated
				const minOutput = new BigNumber(expectedOutput)
					.multipliedBy(0.975)
					.toFixed(0)
				expectedNeutralCoinAmount = expectedNeutralCoinAmount.plus(minOutput)
				msgs.push(
					this.exchangeInterface.produceSwapMessage(
						route,
						{ denom: collateral.denom, amount: collateralAmount.toFixed(0) },
						minOutput,
						liquidatorAddress,
					)
				)
			}
		}
		
		return expectedNeutralCoinAmount
	}

	async appendSwapToDebtMessages(
		debtsToRepay: Coin[],
		liquidatorAddress: string,
		msgs: EncodeObject[],
		neutralAvailable: BigNumber,
	): Promise<Map<string, BigNumber>> {
		let remainingNeutral = neutralAvailable
		const expectedDebtAssetsPostSwap: Map<string, BigNumber> = new Map()

		for (const debt of debtsToRepay) {

			if (debt.denom === this.config.neutralAssetDenom) {
				const cappedAmount = remainingNeutral.isLessThan(debt.amount)
					? remainingNeutral
					: new BigNumber(debt.amount)
				remainingNeutral = neutralAvailable.minus(cappedAmount.minus(1))

				const totalDebt = cappedAmount.plus(expectedDebtAssetsPostSwap.get(debt.denom) || 0)
				expectedDebtAssetsPostSwap.set(debt.denom, totalDebt)
			} else {

				let debtPrice = this.prices.get(debt.denom)
				if (!debtPrice) {
					throw new Error(`No price for debt: ${debt.denom}`)
				}
				let amountToSwap = new BigNumber(debt.amount).multipliedBy(debtPrice)
				amountToSwap = amountToSwap.isGreaterThan(neutralAvailable) ? neutralAvailable : amountToSwap
				let {
					route,
					expectedOutput,
				} = await this.routeRequestApi.requestRoute(
					"https://app.astroport.fi/api/",
					this.config.neutralAssetDenom,
					debt.denom,
					amountToSwap.toFixed(0),
				)


				msgs.push(
					this.exchangeInterface.produceSwapMessage(
						route,
						{ denom: this.config.neutralAssetDenom, amount: amountToSwap.toFixed(0) },
						expectedOutput,
						liquidatorAddress,
					)
				)

				expectedDebtAssetsPostSwap.set(debt.denom, new BigNumber(expectedOutput))
			}
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

		console.log('Checking for liquidations')
		// Pop latest unhealthy positions from the list - cap this by the number of liquidators we have available
		const url = `${this.config.marsEndpoint!}/v1/unhealthy_positions/${this.config.chainName.toLowerCase()}/redbank`

		const response = await fetch(url);
		let targetAccountObjects: {
			account_id: string,
			health_factor: string,
			total_debt: string
		}[] = (await response.json())['data']

		const  targetAccounts = targetAccountObjects.filter(
			(account) =>
				// To target specific accounts, filter here
				account.total_debt.length > 3
			)
			.sort((accountA, accountB)=> Number(accountB.total_debt) - Number(accountA.total_debt))

		// Sleep to avoid spamming.
		if (targetAccounts.length == 0) {
			await sleep(2000)
			return
		}

		// for each account, run liquidations
		for (const account of targetAccounts) {
			console.log("running liquidation for account: ", account.account_id)
			try {
				await this.runLiquidation(account.account_id, liquidatorAddress)
			} catch (e) {
				console.log('ERROR:', e)
			}
		}
	}

	runLiquidation = async (liquidateeAddress: string, liquidatorAddress: string) => {
		await this.withdrawAndSwapCollateral(liquidatorAddress)

		// Fetch position data
		const positionData: DataResponse[] = await fetchRedbankBatch(
			[{ Identifier:  liquidateeAddress }],
			this.config.redbankAddress,
			this.config.hiveEndpoint,
		)

		console.log(`- found ${positionData.length} positions queued for liquidation. `)

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

		await this.withdrawAndSwapCollateral(liquidatorAddress)

		this.redis.incrementBy('executor.liquidations.executed', txs.length)

		console.log(`- Successfully liquidated ${txs.length} positions`)

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

	withdrawAndSwapCollateral = async (liquidatorAddress: string) => {
		const collaterals: Collateral[] = await this.queryClient?.queryContractSmart(
			this.config.redbankAddress,
			{ user_collaterals: { user: liquidatorAddress } },
		)

		// second block of transactions
		let secondBatch: EncodeObject[] = []

		const balances = await this.client?.getAllBalances(liquidatorAddress)

		const combinedCoins = this.combineBalances(collaterals, balances!)

		this.appendWithdrawMessages(collaterals, liquidatorAddress, secondBatch)
		await this.appendSwapToNeutralMessages(combinedCoins, liquidatorAddress, secondBatch)
		if (secondBatch.length > 0) {
			await this.client.signAndBroadcast(
				this.config.liquidatorMasterAddress,
				secondBatch,
				await this.getFee(secondBatch, this.config.liquidatorMasterAddress),
			)
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
			amount: coins(60000, this.config.gasDenom),
			gas: Number(gasEstimated * 1.3).toFixed(0),
		}

		return fee
	}
}
