import { AMMRouter } from '../ammRouter'
import { MarketInfo } from './types/marketInfo'
import { Collateral, Debt, PositionType } from './types/roverPosition.js'
import {
	Action,
	Coin,
	VaultPositionType,
	VaultBaseForString,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import BigNumber from 'bignumber.js'
import { RouteHop } from '../types/routeHop'
import {
	NO_ROUTE_FOR_SWAP,
	NO_VALID_MARKET,
	POOL_NOT_FOUND,
	UNSUPPORTED_VAULT,
} from './constants/errors.js'
import { GENERIC_BUFFER } from './constants/Variables.js'
import { VaultInfo } from '../hive'
import {
	UncollateralizedLoanLimitResponse,
	UserDebtResponse,
} from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types'
import { findUnderlying } from '../helpers'
import { SwapperRoute } from '../types/swapper'

export class LiquidationActionGenerator {
	private router: AMMRouter
	private swapperRoutes: SwapperRoute[]

	constructor(osmosisRouter: AMMRouter) {
		this.router = osmosisRouter
		this.swapperRoutes = []
	}

	setSwapperRoutes = (swapperRoutes: SwapperRoute[]) => {
		this.swapperRoutes = swapperRoutes
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
		markets: MarketInfo[],
		whitelistedAssets: string[],
		creditLines: UserDebtResponse[],
		creditLineCaps: UncollateralizedLoanLimitResponse[],
	): Action[] => {
		// estimate our debt to repay - this depends on collateral amount and close factor
		const maxRepayValue = collateral.value * collateral.closeFactor
		const maxDebtValue = debt.amount * debt.price
		const debtToRepayRatio = maxDebtValue <= maxRepayValue ? 1 : maxRepayValue / maxDebtValue

		// debt amount is a number, not a value (e.g in dollar / base asset denominated terms)
		let debtAmount = debt.amount * debtToRepayRatio

		const debtCoin: Coin = {
			amount: debtAmount.toFixed(0),
			denom: debt.denom,
		}

		// if asset is not enabled, or we have less than 50% the required liquidity, do alternative borrow
		const marketInfo: MarketInfo | undefined = markets.find((market) => market.denom === debt.denom)
		const creditLine: UserDebtResponse | undefined = creditLines.find(
			(creditLine) => creditLine.uncollateralized && debt.denom === creditLine.denom,
		)
		const creditLineCap: UncollateralizedLoanLimitResponse | undefined = creditLineCaps.find(
			(creditLineCap) => creditLineCap.denom == debt.denom,
		)

		const remainingCreditLine =
			creditLineCap && creditLine
				? BigNumber(creditLineCap.limit).minus(creditLine.amount)
				: new BigNumber(0)
		if (
			!marketInfo ||
			!marketInfo.borrow_enabled ||
			!whitelistedAssets.find((denom) => denom === debt.denom) ||
			remainingCreditLine.dividedBy(2).isLessThan(debtAmount) ||
			marketInfo.available_liquidity / debtAmount < 0.5
		) {
			return this.borrowWithoutLiquidity(debtCoin, markets, whitelistedAssets)
		}

		// if we have some liquidity but not enough, scale down
		if (marketInfo.available_liquidity / debtAmount < 1) {
			debtCoin.amount = (marketInfo.available_liquidity * GENERIC_BUFFER).toFixed(0)
		}

		return [this.produceBorrowAction(debtCoin)]
	}

	/**
	 * This method facilitates "borrowing" an asset that does not currently have liqudity in mars.
	 * Examples where this can happen is where the required asset is disabled/removed from whitelist
	 * or utilsation is 100%.
	 *
	 * This method provides the requested asset by borrowing a separate asset and swapping it to the
	 * requested asset. This will obviously incur fees + slippage so should only be used in emergencies.
	 *
	 * @param debtCoin The debt that we are required to repay to perform the liquidation
	 * @returns an array of actions that will update the state to have the requested coin.
	 */
	borrowWithoutLiquidity = (
		debtCoin: Coin,
		markets: MarketInfo[],
		whitelistedAssets: string[],
	): Action[] => {
		// Assign inner coin variables for ease of use, as we use many times
		const debtAmount = new BigNumber(debtCoin.amount)
		const debtdenom = debtCoin.denom

		// filter out disabled markets + our debt denom to avoid corrupted swap messages
		// sort the markets by best -> worst swap in terms of redbank liqudity and cost, and return the best.
		const bestMarket = markets
			.filter(
				(market) =>
					market.borrow_enabled &&
					market.denom !== debtdenom &&
					whitelistedAssets.find((denom) => market.denom === denom),
			)

			.sort((marketA, marketB) => {
				// find best routes for each market we are comparing. Best meaning cheapest input amount to get our required output
				const marketARoute = this.router.getBestRouteGivenOutput(
					marketA.denom,
					debtCoin.denom,
					debtAmount,
				)
				const marketBRoute = this.router.getBestRouteGivenOutput(
					marketB.denom,
					debtCoin.denom,
					debtAmount,
				)

				const marketADenomInput = this.router.getRequiredInput(debtAmount, marketARoute)
				const marketBDenomInput = this.router.getRequiredInput(debtAmount, marketBRoute)

				// params to represent sufficient liquidity
				const marketALiquiditySufficient =
					marketADenomInput.toNumber() < marketA.available_liquidity * GENERIC_BUFFER
				const marketBLiquiditySufficient =
					marketBDenomInput.toNumber() < marketB.available_liquidity * GENERIC_BUFFER

				// if neither market has liqudity, return which one has the larger share
				if (!marketALiquiditySufficient && !marketBLiquiditySufficient) {
					return (
						marketA.available_liquidity / marketADenomInput.toNumber() -
						marketB.available_liquidity / marketBDenomInput.toNumber()
					)
				}

				// todo factor in credit lines here
				// const marketACreditLine = creditLines.find((creditLine) => creditLine.denom === marketA.denom)
				// const marketBCreditLine =

				// if market b does not have liqudity, prioritise a
				if (marketALiquiditySufficient && !marketBLiquiditySufficient) {
					return 1
				}

				// if market a does not have liqudity, prioritise b
				if (!marketALiquiditySufficient && marketBLiquiditySufficient) {
					return -1
				}

				// if both have liqudity, return that with the cheapest swap
				return marketADenomInput.minus(marketBDenomInput).toNumber()
			})
			.pop()

		if (!bestMarket) throw new Error(NO_VALID_MARKET)

		const bestRoute = this.router.getBestRouteGivenOutput(bestMarket.denom, debtdenom, debtAmount)

		if (bestRoute.length === 0) throw new Error(NO_ROUTE_FOR_SWAP)

		const inputRequired = this.router.getRequiredInput(debtAmount, bestRoute)
		// cap borrow to be under market liquidity
		const safeBorrow =
			inputRequired.toNumber() > bestMarket.available_liquidity
				? new BigNumber(bestMarket.available_liquidity * GENERIC_BUFFER)
				: inputRequired

		const actions: Action[] = []

		const borrow: Action = this.produceBorrowAction({
			amount: safeBorrow.toFixed(0),
			denom: bestMarket.denom,
		})

		actions.push(borrow)

		// Create swap message(s). Note that we are not passing in the swap amount, which means that
		// the credit manager will swap everything that we have for that asset inside of our
		// credit manager sub account. To minimise slippage, should ensure that we do not keep
		// additional funds inside the subaccount we are using for liquidations
		bestRoute.forEach((hop: RouteHop) => {
			const action = this.produceSwapAction(hop.tokenInDenom, hop.tokenOutDenom)
			actions.push(action)
		})

		return actions
	}

	private isViableRoute = (route: RouteHop[]): boolean => {
		// Filter to just routes that are viable in the swapper
		return (
			route.filter(
				(hop) =>
					this.swapperRoutes.find(
						(swapperRoute) =>
							swapperRoute.denom_in === hop.tokenInDenom &&
							swapperRoute.denom_out === hop.tokenOutDenom,
					) !== undefined,
			).length > 0
		)
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
	 * @param outAmount
	 * @returns An array of swap actions that convert the asset from collateral to the debt.
	 */
	generateSwapActions = (
		assetInDenom: string,
		assetOutDenom: string,
		outAmount: string,
	): Action[] => {
		const bnOut = new BigNumber(outAmount)
		const routes: RouteHop[][] = this.router.getRoutes(assetInDenom, assetOutDenom)

		// filter routes by those available in the swap router
		const enabledRoutes = routes.filter((route) => this.isViableRoute(route))
		const route = this.router.getRouteWithLowestInput(bnOut, enabledRoutes)

		if (route.length === 0) throw new Error(NO_ROUTE_FOR_SWAP)

		return route.map((hop: RouteHop) =>
			this.produceSwapAction(hop.tokenInDenom, hop.tokenOutDenom, process.env.SLIPPAGE_LIMIT),
		)
	}

	produceRefundAllAction = (): Action => {
		return {
			refund_all_coin_balances: {},
		}
	}

	produceLiquidationAction = (
		positionType: PositionType,
		debtCoin: Coin,
		liquidateeAccountId: string,
		requestCoinDenom: string,
		vaultPositionType?: VaultPositionType,
	): Action => {
		return positionType === PositionType.COIN
			? this.produceLiquidateCoin(debtCoin, liquidateeAccountId, requestCoinDenom)
			: this.produceLiquidateVault(debtCoin, liquidateeAccountId, vaultPositionType!, {
					address: requestCoinDenom,
			  })
	}

	produceVaultToDebtActions = (vault: VaultInfo, borrowDenom: string): Action[] => {
		let vaultActions: Action[] = []
		if (!vault) throw new Error(UNSUPPORTED_VAULT)

		const lpTokenDenom = vault.baseToken
		const poolId = lpTokenDenom.split('/').pop()

		// withdraw lp
		const withdraw = this.produceWithdrawLiquidityAction(lpTokenDenom)

		vaultActions.push(withdraw)

		const pool = this.router.getPool(poolId!)

		// todo log id - this shouldn't happen though
		if (!pool) throw new Error(`${POOL_NOT_FOUND} : ${poolId}`)

		pool.poolAssets
			.filter((poolAsset) => poolAsset.token.denom !== borrowDenom)
			.forEach(
				(poolAsset) =>
					(vaultActions = vaultActions.concat(
						this.generateSwapActions(poolAsset.token.denom, borrowDenom, '1'),
					)),
			)
		return vaultActions
	}

	produceWithdrawLiquidityAction = (lpTokenDenom: string): Action => {
		return {
			withdraw_liquidity: {
				lp_token: {
					amount: 'account_balance',
					denom: lpTokenDenom,
				},
			},
		}
	}

	/**
	 * @param collateralDenom The collateral we recieve from the liquidation
	 * @param debtDenom The debt we need to repay
	 */
	generateRepayActions = (debtDenom: string): Action[] => {
		const actions = []
		actions.push(this.produceRepayAction(debtDenom))

		return actions
	}

	convertCollateralToDebt = (
		collateralDenom: string,
		borrow: Coin,
		vault: VaultInfo | undefined,
	): Action[] => {
		return vault !== undefined
			? this.produceVaultToDebtActions(vault!, borrow.denom)
			: this.swapCollateralCoinToBorrowActions(collateralDenom, borrow)
	}

	swapCollateralCoinToBorrowActions = (collateralDenom: string, borrowed: Coin): Action[] => {
		let actions: Action[] = []
		// if gamm token, we need to do a withdraw of the liquidity
		if (collateralDenom.startsWith('gamm/')) {
			// is this safe?
			actions.push(this.produceWithdrawLiquidityAction(collateralDenom))

			// find underlying tokens and swap to borrowed asset
			const underlyingDenoms = findUnderlying(collateralDenom, this.router.getPools())
			underlyingDenoms?.forEach((underlyingDenom) => console.log(underlyingDenom))
			underlyingDenoms?.forEach((denom) => {
				if (denom !== borrowed.denom) {
					actions = actions.concat(this.generateSwapActions(denom, borrowed.denom, borrowed.amount))
				}
			})
		} else {
			actions = actions.concat(
				this.generateSwapActions(collateralDenom, borrowed.denom, borrowed.amount),
			)
		}

		actions.forEach((action) => console.log(action))
		return actions
	}

	private produceLiquidateCoin = (
		debtCoin: Coin,
		liquidateeAccountId: string,
		requestCoinDenom: string,
	): Action => {
		return {
			liquidate_coin: {
				debt_coin: debtCoin,
				liquidatee_account_id: liquidateeAccountId,
				request_coin_denom: requestCoinDenom,
			},
		}
	}

	private produceLiquidateVault = (
		debtCoin: Coin,
		liquidateeAccountId: string,
		vaultPositionType: VaultPositionType,
		requestVault: VaultBaseForString,
	): Action => {
		return {
			liquidate_vault: {
				debt_coin: debtCoin,
				liquidatee_account_id: liquidateeAccountId,
				position_type: vaultPositionType,
				request_vault: requestVault,
			},
		}
	}

	private produceRepayAction = (denom: string): Action => {
		return {
			repay: {
				amount: 'account_balance',
				denom: denom,
			},
		}
	}

	private produceSwapAction = (
		denomIn: string,
		denomOut: string,
		slippage: string = '0.005',
	): Action => {
		return {
			swap_exact_in: {
				coin_in: { denom: denomIn, amount: 'account_balance' },
				denom_out: denomOut,
				slippage: slippage,
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
}
