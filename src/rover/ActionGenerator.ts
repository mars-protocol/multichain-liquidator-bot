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
import { POOL_NOT_FOUND, UNSUPPORTED_VAULT } from './constants/errors'
import { calculateTotalPerpPnl, queryAstroportLpUnderlyingTokens } from '../helpers'
import { VaultInfo } from '../query/types'
import { PoolType, XYKPool } from '../types/Pool'
import { RouteRequester } from '../query/routing/RouteRequesterInterface'

export class ActionGenerator {
	private routeRequester: RouteRequester

	constructor(routeRequester: RouteRequester) {
		this.routeRequester = routeRequester
	}

	generateLiquidationActions = async (
		account: Positions,
		oraclePrices: Map<string, BigNumber>,
		redbankMarkets: Map<string, MarketInfo>,
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
		const totalPerpPnl = calculateTotalPerpPnl(account.perps)

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
				: this.findBestDebt(account.debts, oraclePrices)

		let borrowActions: Action[] = this.produceBorrowActions(debt, collateral, redbankMarkets)

		// variables
		const { borrow } = borrowActions[0] as { borrow: Coin }

		const slippage = process.env.SLIPPAGE || '0.005'

		const liquidateAction = this.produceLiquidationAction(
			collateral.type,
			{ denom: debt.denom, amount: debt.amount.toFixed(0) },
			account.account_id,
			collateral.denom,
		)

		const collateralToDebtActions =
			collateral.denom !== borrow.denom
				? await this.swapCollateralCoinToDebtActions(
						collateral.denom,
						borrow,
						slippage,
						oraclePrices,
				  )
				: []

		const repayMsg = this.generateRepayActions(borrow.denom)
		// todo estimate amount based on repay to prevent slippage.
		const swapToStableMsg =
			borrow.denom !== neutralDenom
				? [
						await this.generateSwapActions(
							borrow.denom,
							neutralDenom,
							oraclePrices.get(borrow.denom)!,
							oraclePrices.get(neutralDenom)!,
							// todo estimate correctly
							'100',
							slippage,
						),
				  ]
				: []
		// const refundAll = this.produceRefundAllAction()

		const actions = [
			...borrowActions,
			liquidateAction,
			...collateralToDebtActions,
			...repayMsg,
			...swapToStableMsg,
			// refundAll,
		]
		if (process.env.DEBUG) {
			actions.forEach((action) => console.log(JSON.stringify(action)))
		}

		return actions
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
		debt: Debt,
		collateral: Collateral,
		//@ts-ignore - to be used for todos in method
		markets: map<string, MarketInfo[]>,
	): Action[] => {
		// TODO
		if (false) {
			console.log(collateral)
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
			amount: debt.amount.toFixed(0),
			denom: debt.denom,
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

		const minReceive = amountBN.multipliedBy(priceRatio).multipliedBy(1 - Number(slippage))
		const route = await this.routeRequester.requestRoute(assetInDenom, assetOutDenom, amountIn)

		const swapperRoute: SwapperRoute = {
			astro: {
				swaps: route.route.map((swap) => {
					return {
						from: swap.tokenInDenom,
						to: swap.tokenOutDenom,
					}
				}),
			},
		}
		return this.produceSwapAction(assetInDenom, assetOutDenom, minReceive.toFixed(0), swapperRoute)
	}

	produceRefundAllAction = (): Action => {
		return {
			refund_all_coin_balances: {},
		}
	}

	produceVaultToDebtActions = async (
		vault: VaultInfo,
		borrow: Coin,
		slippage: string,
		prices: Map<string, BigNumber>,
	): Promise<Action[]> => {
		let vaultActions: Action[] = []
		if (!vault) throw new Error(UNSUPPORTED_VAULT)

		const lpTokenDenom = vault.baseToken
		const poolId = lpTokenDenom.split('/').pop()

		// withdraw lp
		const withdraw = this.produceWithdrawLiquidityAction(lpTokenDenom)

		vaultActions.push(withdraw)

		//@ts-ignore
		// Convert pool assets to borrowed asset
		const pool = this.router.getPool(poolId!)

		// todo log id - this shouldn't happen though
		if (!pool) throw new Error(`${POOL_NOT_FOUND} : ${poolId}`)

		// todo = support CL/Stableswap on rover
		if (
			pool.poolType === PoolType.CONCENTRATED_LIQUIDITY ||
			pool.poolType === PoolType.STABLESWAP
		) {
			return []
		}

		let filteredPools = (pool as XYKPool).poolAssets.filter(
			(poolAsset) => poolAsset.token.denom !== borrow.denom,
		)

		for (const poolAsset of filteredPools) {
			const assetOutPrice = prices.get(borrow.denom)!
			const assetInPrice = prices.get(poolAsset.token.denom)!
			const amountIn = new BigNumber(assetOutPrice.dividedBy(assetInPrice)).multipliedBy(
				borrow.amount,
			)
			vaultActions.push(
				await this.generateSwapActions(
					poolAsset.token.denom,
					borrow.denom,
					assetInPrice,
					assetOutPrice,
					amountIn.toFixed(0),
					slippage,
				),
			)
		}
		return vaultActions
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
		collateralDenom: string,
		borrowed: Coin,
		slippage: string,
		prices: Map<string, BigNumber>,
	): Promise<Action[]> => {
		let actions: Action[] = []

		console.log(JSON.stringify(prices.keys()))
		console.log(collateralDenom)
		console.log(borrowed.denom)
		const assetInPrice = prices.get(collateralDenom)!
		const assetOutPrice = prices.get(borrowed.denom)!

		// Check if is LP token
		if (collateralDenom.startsWith('gamm/') || collateralDenom.endsWith('astroport/share')) {
			actions.push(this.produceWithdrawLiquidityAction(collateralDenom))

			// find underlying tokens and swap to borrowed asset
			const underlyingDenoms = (await queryAstroportLpUnderlyingTokens(collateralDenom))!
			for (const denom of underlyingDenoms) {
				if (denom !== borrowed.denom) {
					// TODO This is a very rough approximation. We could optimise and make more accurate
					const amountIn = assetOutPrice
						.dividedBy(assetInPrice)
						.multipliedBy(borrowed.amount)
						.dividedBy(underlyingDenoms.length)
						// This could be a source of bugs, if the amount of underlying tokens in the pools
						// are not even. So we err on the side of caution.
						.multipliedBy(0.5)
					actions = actions.concat(
						await this.generateSwapActions(
							denom,
							borrowed.denom,
							assetInPrice,
							assetOutPrice,
							amountIn.toFixed(0),
							slippage,
						),
					)
				}
			}
		} else {
			// TODO this is a rough approximation
			let amountIn = assetOutPrice
				.dividedBy(assetInPrice)
				.multipliedBy(borrowed.amount)
				.multipliedBy(0.8)

			actions = actions.concat(
				await this.generateSwapActions(
					collateralDenom,
					borrowed.denom,
					assetInPrice,
					assetOutPrice,
					amountIn.toFixed(0),
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
		return {
			swap_exact_in: {
				coin_in: { denom: denomIn, amount: 'account_balance' },
				denom_out: denomOut,
				min_receive: minReceive,
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

	findBestDebt = (debts: DebtAmount[], oraclePrices: Map<string, BigNumber>): Debt => {
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
}
