import { MarketInfo } from './types/MarketInfo.js'
import { Collateral, Debt, PositionType } from './types/RoverPosition.js'
import {
	Action,
	Coin,
	VaultPositionType,
	SwapperRoute,
	LiquidateRequestForVaultBaseForString,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import BigNumber from 'bignumber.js'
import {
	POOL_NOT_FOUND,
	UNSUPPORTED_VAULT,
} from './constants/errors.js'
import { queryAstroportLpUnderlyingTokens } from '../helpers.js'
import { VaultInfo } from '../query/types.js'
import { PoolType, XYKPool } from '../types/Pool.js'
import { RouteRequester } from '../query/routing/RouteRequesterInterface.js'

export class ActionGenerator {

	private routeRequester: RouteRequester

	constructor(routeRequester: RouteRequester) {
		this.routeRequester = routeRequester
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
		markets: MarketInfo[],
	): Action[] => {
		// estimate our debt to repay - this depends on collateral amount and close factor
		let maxRepayValue = new BigNumber(collateral.value * collateral.closeFactor)
		const maxDebtValue = debt.price.multipliedBy(debt.amount)
		const debtCeiling = new BigNumber(1000000000)
		if (maxDebtValue.isGreaterThan(debtCeiling)) {
			maxRepayValue = debtCeiling
		}
		const debtToRepayRatio = maxDebtValue <= maxRepayValue ? new BigNumber(1) : maxRepayValue.dividedBy(maxDebtValue)

		// debt amount is a number, not a value (e.g in dollar / base asset denominated terms)
		let debtAmount = debtToRepayRatio.multipliedBy(debt.amount)
		const debtCoin: Coin = {
			amount: debtAmount.toFixed(0),
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
	 * @param amount`
	 * @returns An array of swap actions that convert the asset from collateral to the debt.
	 */
	generateSwapActions = async(
		assetInDenom: string,
		assetOutDenom: string,
		amount: string,
		slippage: string
	): Promise<Action> => {

		const amountBN = BigNumber(amount)
		const minReceive = amountBN.multipliedBy(1-Number(slippage))
		const route = await this.routeRequester.requestRoute(assetInDenom, assetOutDenom, amount);

		const swapperRoute: SwapperRoute = {
			astro: {
				swaps: route.route.map((swap) => {
					return {
						from: swap.tokenInDenom,
						to: swap.tokenOutDenom
					}
				})
			}
		}
		return this.produceSwapAction(assetInDenom, assetOutDenom, minReceive.toFixed(0),swapperRoute)
	}

	produceRefundAllAction = (): Action => {
		return {
			refund_all_coin_balances: {},
		}
	}

	produceVaultToDebtActions = async (vault: VaultInfo, borrow: Coin, slippage: string, prices: Map<string, BigNumber>): Promise<Action[]> => {
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
		if (pool.poolType === PoolType.CONCENTRATED_LIQUIDITY || pool.poolType === PoolType.STABLESWAP) {
			return []
		}

		let filteredPools = (pool as XYKPool).poolAssets
			.filter((poolAsset) => poolAsset.token.denom !== borrow.denom)

		for (const poolAsset of filteredPools) {
			const assetOutPrice = prices.get(borrow.denom)!
			const assetInPrice = prices.get(poolAsset.token.denom)!
			const amountIn = new BigNumber(assetOutPrice.dividedBy(assetInPrice))
									.multipliedBy(borrow.amount);
			(vaultActions.push(
				await this.generateSwapActions(
					poolAsset.token.denom,
					borrow.denom,
					amountIn.toFixed(0),
					slippage
				),
			))
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

	convertCollateralToDebt = async (
		collateralDenom: string,
		borrow: Coin,
		vault: VaultInfo | undefined,
		slippage: string,
		prices: Map<string, BigNumber>,
	): Promise<Action[]> => {
		return vault !== undefined
			? await this.produceVaultToDebtActions(vault!, borrow, slippage, prices)
			: await this.swapCollateralCoinToDebtActions(collateralDenom, borrow, slippage, prices)
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
	swapCollateralCoinToDebtActions = async(collateralDenom: string, borrowed: Coin, slippage: string, prices: Map<string, BigNumber>): Promise<Action[]> => {
		let actions: Action[] = []
		// Check if is LP token
		if (collateralDenom.startsWith('gamm/') || collateralDenom.endsWith('astroport/share')) {
			actions.push(this.produceWithdrawLiquidityAction(collateralDenom))

			// find underlying tokens and swap to borrowed asset
			const underlyingDenoms = await queryAstroportLpUnderlyingTokens(collateralDenom)
			for (const denom of underlyingDenoms!) {
				if (denom !== borrowed.denom) {
					const assetOutPrice = prices.get(borrowed.denom)!
					const assetInPrice = prices.get(collateralDenom)!
					const amountIn = new BigNumber(assetOutPrice.dividedBy(assetInPrice)).multipliedBy(Number(borrowed.amount))
					actions = actions.concat(await this.generateSwapActions(denom, borrowed.denom, amountIn.toFixed(0), slippage))
				}
			}
		} else {
			actions = actions.concat(
				await this.generateSwapActions(collateralDenom, borrowed.denom, borrowed.amount, slippage),
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
		vaultPositionType?: VaultPositionType,
	) : Action => {
		return { 
			liquidate: {
				debt_coin: debtCoin,
				liquidatee_account_id: liquidateeAccountId,
				request: this.produceLiquidationRequest(positionType, requestCoinDenom,vaultPositionType)
			},
		}
	}

	private produceLiquidationRequest = (
		positionType: PositionType,
		collateralRequestDenom: string,
		vaultPositionType?: VaultPositionType,
	): LiquidateRequestForVaultBaseForString => {
		switch (positionType) {
			case PositionType.DEPOSIT:
				return { deposit: collateralRequestDenom! }
			case PositionType.LEND:
				return { lend: collateralRequestDenom! }
			case PositionType.VAULT:
				return { 
					vault : {
						position_type: vaultPositionType!,
						request_vault: { address: collateralRequestDenom }
					}
				}
			case PositionType.STAKED_ASTRO_LP:
				return { staked_astro_lp: collateralRequestDenom! }
			default:
				break;
		}

		throw new Error(`Failure to find correct position type. Recieved: ${positionType}`)
	}

	private produceRepayAction = (denom: string): Action => {
		return {
			repay: {
				coin: {
					amount: 'account_balance',
					denom: denom,
				}
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
}
