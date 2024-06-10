import { AMMRouter } from '../AmmRouter'
import { MarketInfo } from './types/MarketInfo'
import { Collateral, Debt, PositionType } from './types/RoverPosition'
import {
	Action,
	Coin,
	VaultPositionType,
	VaultBaseForString,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import BigNumber from 'bignumber.js'
import { RouteHop } from '../types/RouteHop'
import {
	NO_ROUTE_FOR_SWAP,
	NO_VALID_MARKET,
	POOL_NOT_FOUND,
	UNSUPPORTED_VAULT,
} from './constants/errors.js'
import { GENERIC_BUFFER } from '../constants'
import {
	UncollateralizedLoanLimitResponse,
	UserDebtResponse,
} from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types'
import { findUnderlying } from '../helpers'
import { SwapperRoute } from '../types/swapper'
import { VaultInfo } from '../query/types'
import { PoolType, XYKPool } from '../types/Pool'
import { getRoute } from '../query/sidecar'

export class LiquidationActionGenerator {
	private router: AMMRouter
	private swapperRoutes: SwapperRoute[]

	constructor(osmosisRouter: AMMRouter) {
		this.router = osmosisRouter
		this.swapperRoutes = []
		console.log(this.swapperRoutes) // todo
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

		// TODO remove caps
		if (false) console.log(creditLines, creditLineCaps)

		// estimate our debt to repay - this depends on collateral amount and close factor
		let maxRepayValue = (collateral.value * collateral.closeFactor)
		const maxDebtValue = debt.amount * debt.price
		const debtCeiling = 3000000000
		if (maxDebtValue > debtCeiling) {
			maxRepayValue = debtCeiling
		}

		const debtToRepayRatio = maxDebtValue <= maxRepayValue ? 1 : maxRepayValue / maxDebtValue

		// debt amount is a number, not a value (e.g in dollar / base asset denominated terms)
		let debtAmount = debt.amount * debtToRepayRatio

		const debtCoin: Coin = {
			amount: debtAmount.toFixed(0),
			denom: debt.denom,
		}

		// if asset is not enabled, or we have less than 50% the required liquidity, do alternative borrow
		const marketInfo: MarketInfo | undefined = markets.find((market) => market.denom === debt.denom)
		if (
			!marketInfo ||
			// TODO - check if asset is whitelisted
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
					market.denom !== debtdenom &&
					whitelistedAssets.find((denom) => market.denom === denom),
			)

			.sort((marketA, marketB) => {
				// find best routes for each market we are comparing. Best meaning cheapest input amount to get our required output

				// TODO we should look to use sqs routes here, to tap into that liquidity
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

		if (bestRoute.length === 0) throw new Error(`${NO_ROUTE_FOR_SWAP}. ${bestMarket.denom} -> ${debtdenom}`)

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
	
	// private getAvailablePools = (): number[] => {
	// 	const pools : number[] = []

	// 	this.swapperRoutes.forEach((route) => {
	// 		route.route.forEach((hop) => {
	// 			// Check if we have already pushed that pool
	// 			if (pools.find((pool)=> pool === hop.pool_id) === undefined) {
	// 				pools.push(hop.pool_id as number)
	// 			}
	// 		})
	// 	})

	// 	return pools
	// }

	// private isViableRoute = (route: RouteHop[]): boolean => {
	// 	return true
	// 	return (
	// 		route.filter(
	// 			(hop) =>
	// 				this.swapperRoutes.find(
	// 					(swapperRoute) =>
	// 						(swapperRoute.denom_in === hop.tokenInDenom &&
	// 						swapperRoute.denom_out === hop.tokenOutDenom) ||
	// 						(swapperRoute.denom_in === hop.tokenOutDenom &&
	// 							swapperRoute.denom_out === hop.tokenInDenom),
	// 				) !== undefined,
	// 		).length > 0
	// 	)
	// }
	/**
	 * Swap the coillateral we won to repay the debt we borrowed. This method calculates the
	 * best route and returns an array of swap actions (on action per route hop) to execute
	 * the swap.
	 * For instance, if there is no direct pool between the collateral won and the debt borrowed,
	 * we will need to use an intermediary pool or even multiple pools to complete the swap.
	 *
	 * @param assetInDenom
	 * @param assetOutDenom
	 * @param amount
	 * @returns An array of swap actions that convert the asset from collateral to the debt.
	 */
	generateSwapActions = async(
		assetInDenom: string,
		assetOutDenom: string,
		amount: string,
		slippage: string
	): Promise<Action[]> => {
		// const bnOut = new BigNumber(outAmount)

		let sqsRoute = await getRoute('https://sqs.osmosis.zone/', amount, assetInDenom, assetOutDenom);

		// const swapperPools : number[] = this.getAvailablePools()

		// const usablePools = this.router.getPools().filter((pool) => swapperPools.indexOf(Number(pool.id)) !== -1)

		// this.router.setPools(usablePools)

		// const routes: RouteHop[][] = this.router.getRoutes(assetInDenom, assetOutDenom)

		// const enabledRoutes = routes.filter((route) => this.isViableRoute(route))

		// console.log(routes)
		// const route = this.router.getRouteWithLowestInput(bnOut, enabledRoutes)

		// if (route.length === 0) throw new Error(`${NO_ROUTE_FOR_SWAP}. ${assetInDenom} -> ${assetOutDenom}`)

		return sqsRoute.map((hop: RouteHop) =>
			this.produceSwapAction(hop.tokenInDenom, hop.tokenOutDenom, slippage),
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
		return positionType === PositionType.VAULT
			? this.produceLiquidateVault(debtCoin, liquidateeAccountId, vaultPositionType!, {
				address: requestCoinDenom,
			})
			: this.produceLiquidateCoin(debtCoin, liquidateeAccountId, requestCoinDenom, positionType === PositionType.DEPOSIT)
	}

	produceVaultToDebtActions = async (vault: VaultInfo, borrow: Coin, slippage: string, prices: Map<string, number>): Promise<Action[]> => {
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

		// todo = support CL/Stableswap on rover
		if (pool.poolType === PoolType.CONCENTRATED_LIQUIDITY || pool.poolType === PoolType.STABLESWAP) {
			return []
		}

		let filteredPools = (pool as XYKPool).poolAssets
			.filter((poolAsset) => poolAsset.token.denom !== borrow.denom)

		for (const poolAsset of filteredPools) {
			const asset_out_price = prices.get(borrow.denom) || 0
			const asset_in_price = prices.get(poolAsset.token.denom) || 0
			const amount_in = (asset_out_price / asset_in_price) * Number(borrow.amount.toString());
			(vaultActions = vaultActions.concat(
				await this.generateSwapActions(poolAsset.token.denom, borrow.denom, amount_in.toFixed(0), slippage),
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
		const actions = []
		actions.push(this.produceRepayAction(debtDenom))

		return actions
	}

	convertCollateralToDebt = async (
		collateralDenom: string,
		borrow: Coin,
		vault: VaultInfo | undefined,
		slippage: string,
		prices: Map<string, number>,
	): Promise<Action[]> => {
		return vault !== undefined
			? await this.produceVaultToDebtActions(vault!, borrow, slippage, prices)
			: await this.swapCollateralCoinToBorrowActions(collateralDenom, borrow, slippage, prices)
	}

	swapCollateralCoinToBorrowActions = async(collateralDenom: string, borrowed: Coin, slippage: string, prices: Map<string, number>): Promise<Action[]> => {
		let actions: Action[] = []
		// if gamm token, we need to do a withdraw of the liquidity
		if (collateralDenom.startsWith('gamm/')) {
			// is this safe?
			actions.push(this.produceWithdrawLiquidityAction(collateralDenom))

			// find underlying tokens and swap to borrowed asset
			const underlyingDenoms = findUnderlying(collateralDenom, this.router.getPools())

			for (const denom of underlyingDenoms!) {
				if (denom !== borrowed.denom) {
					const asset_out_price = prices.get(borrowed.denom) || 0
					const asset_in_price = prices.get(collateralDenom) || 0
					const amount_in = (asset_out_price / asset_in_price) * Number(borrowed.amount) 
					actions = actions.concat(await this.generateSwapActions(denom, borrowed.denom, amount_in.toFixed(0), slippage))
				}
			}
		} else {
			const asset_out_price = prices.get(borrowed.denom) || 0
			const asset_in_price = prices.get(collateralDenom) || 0
			const amount_in = (asset_out_price / asset_in_price) * Number(borrowed.amount) 
			actions = actions.concat(
				await this.generateSwapActions(collateralDenom, borrowed.denom, amount_in.toFixed(0), slippage),
			)
		}

		return actions
	}

	private produceLiquidateCoin = (
		debtCoin: Coin,
		liquidateeAccountId: string,
		requestCoinDenom: string,
		isDeposit : boolean
	): Action => {
		return {
			liquidate:{
				debt_coin: debtCoin,
				liquidatee_account_id: liquidateeAccountId,	
				request: isDeposit ? { deposit: requestCoinDenom } : { lend : requestCoinDenom }
			}
		}
	}

	private produceLiquidateVault = (
		debtCoin: Coin,
		liquidateeAccountId: string,
		vaultPositionType: VaultPositionType,
		requestVault: VaultBaseForString,
	): Action => {
		return {
			liquidate: {
				debt_coin: debtCoin,
				liquidatee_account_id: liquidateeAccountId,
				request: {
					vault: {
						position_type: vaultPositionType,
						request_vault: requestVault
					}
				}
			},
		}
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
