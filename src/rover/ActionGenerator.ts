import { MarketInfo } from './types/MarketInfo.js'
import { Collateral, Debt, PositionType } from './types/RoverPosition'
import {
	Action,
	Coin,
	SwapperRoute,
	LiquidateRequestForVaultBaseForString,
	Positions,
	DebtAmount,
} from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import BigNumber from 'bignumber.js'
import {
	calculateTotalPerpPnl,
	queryAstroportLpUnderlyingCoins,
	queryOsmosisLpUnderlyingCoins,
} from '../helpers'
import { RouteRequester } from '../query/routing/RouteRequesterInterface'
import {
	LiquidationAmountInputs,
	calculate_liquidation_amounts_js,
	HealthData,
} from 'mars-liquidation'
import { AssetParamsBaseForAddr } from 'marsjs-types/mars-params/MarsParams.types.js'

const MAX_DEBT_AMOUNT = 1000000000
const AXL_USDC_DENOM = 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858'
const NOBLE_USDC_DENOM = 'ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4'

export class ActionGenerator {
	private routeRequester: RouteRequester

	constructor(routeRequester: RouteRequester) {
		this.routeRequester = routeRequester
	}

	generateLiquidationActions = async (
		chainName: string,
		account: Positions,
		oraclePrices: Map<string, BigNumber>,
		redbankMarkets: Map<string, MarketInfo>,
		assetParams: Map<string, AssetParamsBaseForAddr>,
		healthData: HealthData,
		neutralDenom: string,
	): Promise<Action[]> => {
		// Find highest value collateral. Note that is merely the largest collateral by oracle price.
		// TODO: We should be taking into account the close factor and underlying market liquidity
		const hasNoCollaterals =
			account.deposits.length === 0 &&
			account.lends.length === 0 &&
			account.staked_astro_lps.length === 0

		const collateral: Collateral = hasNoCollaterals
			? {
					type: PositionType.DEPOSIT,
					value: new BigNumber(0),
					amount: new BigNumber(0),
					denom: neutralDenom,
			  }
			: this.findHighestValueCollateral(account, oraclePrices)

		// Perp pnl
		let hasPerps = account.perps && account.perps.length > 0
		const totalPerpPnl = hasPerps ? calculateTotalPerpPnl(account.perps) : new BigNumber(0)

		// In some cases, a position may be unhealthy but have no debt, as all the negative pnl is
		// covered by the collateral. In this case, we can use the total amount of perp debt
		const debt =
			account.debts.length === 0
				? {
						amount: new BigNumber(totalPerpPnl.abs()),
						// TODO think this should be explicity base denom, otherwise we might get bugs
						denom: neutralDenom,
						value: new BigNumber(0),
				  }
				: this.findLargestDebt(account.debts, oraclePrices)

		const maxDebtAmount = debt.amount.gt(MAX_DEBT_AMOUNT)
			? new BigNumber(MAX_DEBT_AMOUNT).dividedBy(oraclePrices.get(debt.denom)!)
			: new BigNumber(debt.amount)

		const liquidationAmountInputs: LiquidationAmountInputs = {
			collateral_amount: collateral.amount.toFixed(0),
			collateral_price: oraclePrices.get(collateral.denom)!.toFixed(18),
			collateral_params: assetParams.get(collateral.denom)!,
			debt_amount: maxDebtAmount.toFixed(0),
			debt_params: assetParams.get(debt.denom)!,
			debt_requested_to_repay: maxDebtAmount.toFixed(0),
			debt_price: oraclePrices.get(debt.denom)!.toFixed(18),
			health: healthData,
			// TODO: do we need to query this?
			perps_lb_ratio: new BigNumber(0.1).toString(),
		}

		const liqHf: number = liquidationAmountInputs.health.liquidation_health_factor
		if (liqHf == null || liqHf >= 1) {
			console.log(`Position with id ${account.account_id} is not liquidatable. HF : ${liqHf}`)
			return []
		}

		const liquidationAmounts = calculate_liquidation_amounts_js(liquidationAmountInputs)

		let borrowActions: Action[] = this.produceBorrowActions(
			debt.denom,
			maxDebtAmount,
			collateral,
			redbankMarkets,
		)

		// variables
		const { borrow } = borrowActions[0] as { borrow: Coin }

		const slippage = process.env.SLIPPAGE || '0.005'

		const liquidateAction = this.produceLiquidationAction(
			collateral.type,
			{ denom: debt.denom, amount: maxDebtAmount.toFixed(0) },
			account.account_id,
			collateral.denom,
		)

		const collateralToDebtActions =
			collateral.denom !== borrow.denom
				? await this.swapCollateralCoinToDebtActions(
						chainName,
						{
							amount: liquidationAmounts.collateral_amount_received_by_liquidator.toString(),
							denom: collateral.denom,
						},
						borrow,
						slippage,
						oraclePrices,
				  )
				: []

		const repayMsg = this.generateRepayActions(borrow.denom)

		const swapToStableActions = await this.produceSwapToStableActions(
			chainName,
			oraclePrices,
			collateral.denom,
			neutralDenom,
			borrow,
			collateralToDebtActions,
			slippage,
		)

		const refundAll = this.produceRefundAllAction()

		const actions = [
			...borrowActions,
			liquidateAction,
			...collateralToDebtActions,
			...repayMsg,
			...swapToStableActions,
			refundAll,
		]
		if (process.env.DEBUG) {
			actions.forEach((action) => console.log(JSON.stringify(action)))
		}

		return actions
	}

	produceSwapToStableActions = async (
		chainName: string,
		oraclePrices: Map<string, BigNumber>,
		collateralDenom: string,
		neutralDenom: string,
		borrow: Coin,
		collateralToDebtActions: Action[],
		slippage: string,
	): Promise<Action[]> => {
		if (borrow.denom === neutralDenom || collateralToDebtActions.length === 0) {
			console.log(`Borrow denom ${borrow.denom} is the same as neutral denom ${neutralDenom}`)
			return []
		}

		const receivedDebtAmount =
			// @ts-ignore
			collateralToDebtActions[collateralToDebtActions.length - 1].swap_exact_in.min_receive
		const remainingDebt = new BigNumber(receivedDebtAmount).minus(borrow.amount)
		if (remainingDebt.isNegative()) {
			console.log('SwapToStableMsg: No profit after repaying debt. Nothing to swap')
			// If this occurs, we probably have an
			return []
		}
		const assetInPrice = oraclePrices.get(collateralDenom)!
		const assetOutPrice = oraclePrices.get(borrow.denom)!
		const priceRatio = assetInPrice.dividedBy(assetOutPrice)
		// 10% buffer here to be defensive. It is more important the liquidation tx succeed
		const minReceive = remainingDebt.multipliedBy(priceRatio).multipliedBy(0.9)
		return [
			await this.generateSwapActions(
				chainName,
				borrow.denom,
				neutralDenom,
				oraclePrices.get(borrow.denom)!,
				oraclePrices.get(neutralDenom)!,
				minReceive.toFixed(0),
				slippage,
			),
		]
	}
	/**
	 * Produce the borrow actions.
	 *
	 * The sunny day case is that we can borrow the exact amount from credit manager
	 * with no issues, however there are edge cases that we need to handle,
	 * such as when borrows for that asset are disabled or the utilisation
	 * is 100%
	 *
	 * To handle this case, we need to borrow a separate asset
	 * and sell that asset to the debt asset.
	 *
	 * @param debt The largest debt in the position
	 * @param collateral The largest collateral in the position
	 */
	produceBorrowActions = (
		debtDenom: string,
		maxRepayableAmount: BigNumber,
		collateral: Collateral,
		//@ts-ignore - to be used for todos in method
		markets: map<string, MarketInfo[]>,
	): Action[] => {
		// TODO
		if (false) {
			console.log(collateral)
		}

		if (debtDenom === AXL_USDC_DENOM) {
			console.log(maxRepayableAmount)

			let actions: Action[] = [
				// borrow usdc
				{
					borrow: {
						amount: new BigNumber(maxRepayableAmount).toFixed(0),
						denom: NOBLE_USDC_DENOM,
					},
				},
				// swap to axlsdc
				{
					swap_exact_in: {
						coin_in: {
							amount: 'account_balance',
							denom: NOBLE_USDC_DENOM,
						},
						denom_out: AXL_USDC_DENOM,
						route: {
							osmo: {
								swaps: [
									{
										pool_id: 1212,
										to: AXL_USDC_DENOM,
									},
								],
							},
						},
						min_receive: new BigNumber(maxRepayableAmount).multipliedBy(0.98).toFixed(0),
					},
				},
			]

			return actions
		}

		// estimate our debt to repay - this depends on collateral amount and close factor
		// let maxRepayValue = new BigNumber(collateral.value * collateral.closeFactor)
		// const maxDebtValue = debt.price.multipliedBy(debt.amount)
		// const debtCeiling = new BigNumber(1000000000)
		// if (maxDebtValue.isGreaterThan(debtCeiling)) {
		// 	maxRepayValue = debtCeiling
		// }
		// const debtToRepayRatio = maxDebtValue <= maxRepayValue ? new BigNumber(1) : maxRepayValue.dividedBy(maxDebtValue)

		// // debt amount is a number, not a value (e.g in dollar / base asset denominated terms)
		// let debtAmount = debtToRepayRatio.multipliedBy(debt.amount)
		const debtCoin: Coin = {
			amount: maxRepayableAmount.toFixed(0),
			denom: debtDenom,
		}

		// TODO - check if asset is whitelisted
		// TODO - borrow without liquidity in debt asset
		// TODO - borrow without debt asset enabled for borrow

		return [this.produceBorrowAction(debtCoin)]
	}

	/**
	 * Swap the coillateral we won to repay the debt we borrowed. This method calculates the
	 * best route and returns an array of swap actions (on action per route hop) to execute
	 * the swap.
	 * For instance, if there is no direct pool between the collateral won and the debt borrowed,
	 * we will need to use an intermediary pool or even multiple pools to complete the swap.
	 *
	 * @param assetInDenom
	 * @param assetOutDenom
	 * @param amountIn
	 * @returns An array of swap actions that convert the asset from collateral to the debt.
	 */
	generateSwapActions = async (
		chainName: string,
		assetInDenom: string,
		assetOutDenom: string,
		assetInPrice: BigNumber,
		assetOutPrice: BigNumber,
		amountIn: string,
		slippage: string,
	): Promise<Action> => {
		const amountBN = BigNumber(amountIn)

		// We need the price ratio to determine the min output
		// For example, if the price of asset in is 10, and the price of asset out is 2,
		// we will get 5 asset out for 1 asset in
		// assetInPrice = 10
		// assetOutPrice = 2
		// priceRatio = assetInPrice / assetOutPrice = 5
		const priceRatio = assetInPrice.dividedBy(assetOutPrice)

		let minReceive = amountBN.multipliedBy(priceRatio).multipliedBy(1 - Number(slippage))

		// Use the new generic route method
		const genericRoute = await this.routeRequester.getRoute({
			denomIn: assetInDenom,
			denomOut: assetOutDenom,
			amountIn: amountIn,
			chainIdIn: chainName === 'osmosis' ? 'osmosis-1' : 'neutron-1',
			chainIdOut: chainName === 'osmosis' ? 'osmosis-1' : 'neutron-1',
		})

		if (minReceive.isNaN() || minReceive.lt(10)) {
			minReceive = new BigNumber(10)
		}

		// Convert GenericRoute to SwapperRoute format
		const swapperRoute: SwapperRoute = this.convertGenericRouteToSwapperRoute(
			genericRoute,
			chainName,
		)

		return this.produceSwapAction(assetInDenom, assetOutDenom, minReceive.toFixed(0), swapperRoute)
	}

	produceRefundAllAction = (): Action => {
		return {
			refund_all_coin_balances: {},
		}
	}

	produceWithdrawLiquidityAction = (lpTokenDenom: string): Action => {
		return {
			withdraw_liquidity: {
				lp_token: {
					amount: 'account_balance',
					denom: lpTokenDenom,
				},
				slippage: '0.01',
			},
		}
	}

	/**
	 * @param collateralDenom The collateral we recieve from the liquidation
	 * @param debtDenom The debt we need to repay
	 */
	generateRepayActions = (debtDenom: string): Action[] => {
		return [this.produceRepayAction(debtDenom)]
	}

	/**
	 * Swap the collateral we won to repay the debt we borrowed. This method calculates the
	 * best route and returns an array of swap actions (on action per route hop) to execute
	 * the swap.
	 * For instance, if there is no direct pool between the collateral won and the debt borrowed,
	 * we will need to use an intermediary pool or even multiple pools to complete the swap.
	 *
	 * If we won an LP token, we need to unwrap and sell the underlying tokens.
	 *
	 * @param collateralDenom
	 * @param borrowed
	 * @param slippage
	 * @param prices
	 * @returns An array of swap actions that convert the collateral to the debt.
	 */
	swapCollateralCoinToDebtActions = async (
		chainName: string,
		collateralWon: Coin,
		borrowed: Coin,
		slippage: string,
		prices: Map<string, BigNumber>,
	): Promise<Action[]> => {
		let actions: Action[] = []
		const collateralDenom = collateralWon.denom
		const collateralAmount = new BigNumber(collateralWon.amount)
		const assetInPrice = prices.get(collateralDenom)!
		const assetOutPrice = prices.get(borrowed.denom)!

		// Check if is LP token
		if (collateralDenom.startsWith('gamm/') || collateralDenom.endsWith('astroport/share')) {
			actions.push(this.produceWithdrawLiquidityAction(collateralDenom))
			const lpCoin = {
				amount: collateralAmount.toFixed(0),
				denom: collateralDenom,
			}
			// find underlying tokens and swap to borrowed asset
			const underlyingCoins = collateralDenom.endsWith('astroport/share')
				? await queryAstroportLpUnderlyingCoins(lpCoin)!
				: await queryOsmosisLpUnderlyingCoins(lpCoin)!
			for (const coin of underlyingCoins) {
				if (coin.denom !== borrowed.denom) {
					// TODO: This could be a source of bugs, if the amount of underlying tokens in the pools
					// are not even.
					actions = actions.concat(
						await this.generateSwapActions(
							chainName,
							coin.denom,
							borrowed.denom,
							assetInPrice,
							assetOutPrice,
							coin.amount,
							slippage,
						),
					)
				}
			}
		} else {
			actions = actions.concat(
				await this.generateSwapActions(
					chainName,
					collateralDenom,
					borrowed.denom,
					assetInPrice,
					assetOutPrice,
					collateralAmount.toFixed(0),
					slippage,
				),
			)
		}

		return actions
	}

	/**
	 * Produce a liquidation action.
	 * @param positionType The type of position we are liquidating
	 * @param debtCoin The coin we want to liquidate
	 * @param liquidateeAccountId The account we are liquidating
	 * @param requestCoinDenom The coin we want to receive
	 * @param vaultPositionType The type of vault position we are liquidating
	 * @returns A liquidation action
	 */
	produceLiquidationAction = (
		positionType: PositionType,
		debtCoin: Coin,
		liquidateeAccountId: string,
		requestCoinDenom: string,
	): Action => {
		return {
			liquidate: {
				debt_coin: debtCoin,
				liquidatee_account_id: liquidateeAccountId,
				request: this.produceLiquidationRequest(positionType, requestCoinDenom),
			},
		}
	}

	private produceLiquidationRequest = (
		positionType: PositionType,
		collateralRequestDenom: string,
	): LiquidateRequestForVaultBaseForString => {
		switch (positionType) {
			case PositionType.DEPOSIT:
				return { deposit: collateralRequestDenom! }
			case PositionType.LEND:
				return { lend: collateralRequestDenom! }
			case PositionType.STAKED_ASTRO_LP:
				return { staked_astro_lp: collateralRequestDenom! }
			default:
				break
		}

		throw new Error(`Failure to find correct position type. Recieved: ${positionType}`)
	}

	private produceRepayAction = (denom: string): Action => {
		return {
			repay: {
				coin: {
					amount: 'account_balance',
					denom: denom,
				},
			},
		}
	}

	private produceSwapAction = (
		denomIn: string,
		denomOut: string,
		minReceive: string,
		route: SwapperRoute | null = null,
	): Action => {
		console.log(`minReceive: ${minReceive}`)
		return {
			swap_exact_in: {
				coin_in: { denom: denomIn, amount: 'account_balance' },
				denom_out: denomOut,
				// Min receive is inaccurate atm, requires improvement in estimation of profit.
				// For now, we set to a small amount. If the liquidation tx is not profitable it
				// will revert anyway.
				min_receive: '100',
				route: route,
			},
		}
	}

	/**
	 * Construct a simple borrow action.
	 * @param debtCoin The coin we want to borrow
	 * @returns A borrow action
	 */
	private produceBorrowAction = (debtCoin: Coin): Action => {
		const borrow: Action = {
			borrow: debtCoin,
		}

		return borrow
	}

	findHighestValueCollateral = (
		positions: Positions,
		oraclePrices: Map<string, BigNumber>,
	): Collateral => {
		// Combine all the users assets
		const allCollaterals: Collateral[] = [
			...positions.deposits.map((deposit) => {
				return {
					type: PositionType.DEPOSIT,
					value: new BigNumber(deposit.amount).multipliedBy(oraclePrices.get(deposit.denom) || 0),
					amount: new BigNumber(deposit.amount),
					denom: deposit.denom,
				}
			}),
			...positions.lends.map((lend) => {
				return {
					type: PositionType.LEND,
					value: new BigNumber(lend.amount).multipliedBy(oraclePrices.get(lend.denom) || 0),
					amount: new BigNumber(lend.amount),
					denom: lend.denom,
				}
			}),
			...positions.staked_astro_lps.map((stakedAstroLp) => {
				return {
					type: PositionType.STAKED_ASTRO_LP,
					value: new BigNumber(stakedAstroLp.amount).multipliedBy(
						oraclePrices.get(stakedAstroLp.denom) || 0,
					),
					amount: new BigNumber(stakedAstroLp.amount),
					denom: stakedAstroLp.denom,
				}
			}),
			// add other collaterals here
		]

		if (allCollaterals.length === 0) throw new Error('Error: No collateral found')

		return allCollaterals
			.sort((collateralA, collateralB) => collateralA.value.minus(collateralB.value).toNumber())
			.pop()!
	}

	calculateCoinValue = (coin: Coin, oraclePrice: BigNumber): number => {
		const amountBn = new BigNumber(coin.amount)
		return amountBn.multipliedBy(oraclePrice).toNumber()
	}

	findLargestDebt = (debts: DebtAmount[], oraclePrices: Map<string, BigNumber>): Debt => {
		if (debts.length === 0) throw new Error('Error: No debts found')
		return debts
			.map((debtAmount) => {
				return {
					amount: new BigNumber(debtAmount.amount),
					denom: debtAmount.denom,
					value: new BigNumber(debtAmount.amount).multipliedBy(
						oraclePrices.get(debtAmount.denom) || 0,
					),
				}
			})
			.sort((debtA, debtB) => debtA.value.minus(debtB.value).toNumber())
			.pop()!
	}

	/**
	 * Convert GenericRoute to SwapperRoute format for backward compatibility
	 */
	private convertGenericRouteToSwapperRoute(genericRoute: any, chainName: string): SwapperRoute {
		// Flatten all steps from all operations
		const allSteps = genericRoute.operations.flatMap((op: any) => op.steps)

		if (chainName === 'osmosis') {
			return {
				osmo: {
					swaps: allSteps.map((step: any, index: number) => ({
						pool_id: index + 1, // Generate sequential pool IDs
						to: step.denomOut,
					})),
				},
			}
		} else {
			return {
				astro: {
					swaps: allSteps.map((step: any) => ({
						from: step.denomIn,
						to: step.denomOut,
					})),
				},
			}
		}
	}
}
