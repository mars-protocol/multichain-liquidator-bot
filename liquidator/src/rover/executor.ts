import { BaseExecutor, BaseExecutorConfig } from '../baseExecutor'
import { makeExecuteContractMessage, sleep } from '../helpers'
import { toUtf8 } from '@cosmjs/encoding'
import { fetchRoverData, fetchRoverPosition, VaultInfo } from '../hive'
import { LiquidationActionGenerator } from './liquidationActionGenerator'
import {
	Coin,
	VaultInfoResponse,
	VaultPosition,
	VaultPositionType,
	VaultUnlockingPosition,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'

import { PriceResponse } from 'marsjs-types/creditmanager/generated/mars-mock-oracle/MarsMockOracle.types'

import BigNumber from 'bignumber.js'
import { Collateral, Debt, PositionType } from './types/roverPosition'
import { SigningStargateClient } from '@cosmjs/stargate'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { MarketInfo } from './types/marketInfo'
import { UNSUPPORTED_ASSET, UNSUPPORTED_VAULT } from './constants/errors'
import {
	UncollateralizedLoanLimitResponse,
	UserDebtResponse,
} from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types'

export interface RoverExecutorConfig extends BaseExecutorConfig {
	creditManagerAddress: string
	swapperAddress: string
	liquidatorAddress: string
	accountNftAddress: string
	minGasTokens: number
}

export class Executor extends BaseExecutor {
	private VAULT_RELOAD_WINDOW = 1800000
	public config: RoverExecutorConfig
	private liquidationActionGenerator: LiquidationActionGenerator
	private creditLines: UserDebtResponse[] = []
	private creditLineCaps: UncollateralizedLoanLimitResponse[] = []

	public liquidatorAccountId = ''
	private whitelistedCoins: string[] = []
	private vaults: string[] = []
	private vaultDetails: Map<string, VaultInfo> = new Map()
	private lastFetchedVaultTime = 0

	constructor(
		config: RoverExecutorConfig,
		client: SigningStargateClient,
		queryClient: CosmWasmClient,
	) {
		super(config, client, queryClient)
		this.config = config
		this.liquidationActionGenerator = new LiquidationActionGenerator(this.ammRouter)
	}

	start = async () => {
		// this will fetch prices etc
		this.initiate()

		this.liquidatorAccountId = await this.setUpAccount()

		while (true) await this.run()
	}

	refreshData = async () => {
		// Periodically refresh the vaults we have
		const currentTimeMs = Date.now()
		if (this.lastFetchedVaultTime + this.VAULT_RELOAD_WINDOW < currentTimeMs) {
			const vaultsData: VaultInfoResponse[] = await this.queryClient.queryContractSmart(
				this.config.creditManagerAddress,
				{ vaults_info: {} },
			)
			this.vaults = vaultsData.map((vaultData) => vaultData.vault.address)
			this.lastFetchedVaultTime = currentTimeMs
		}

		// dispatch hive request and parse it
		const roverData = await fetchRoverData(
			this.config.hiveEndpoint,
			this.config.liquidatorMasterAddress,
			this.config.redbankAddress,
			this.config.oracleAddress,
			this.config.creditManagerAddress,
			this.config.swapperAddress,
			this.vaults,
		)

		this.markets = roverData.markets.map((market: MarketInfo) =>
			this.applyAvailableLiquidity(market),
		)
		roverData.masterBalance.forEach((coin) => this.balances.set(coin.denom, Number(coin.amount)))
		roverData.prices.forEach((price: PriceResponse) =>
			this.prices.set(price.denom, Number(price.price)),
		)
		this.whitelistedCoins = roverData.whitelistedAssets! as string[]
		this.vaultDetails = roverData.vaultInfo
		this.creditLines = roverData.creditLines
		this.creditLineCaps = roverData.creditLineCaps

		this.liquidationActionGenerator.setSwapperRoutes(roverData.routes)

		const pools = await this.loadPools()
		this.ammRouter.setPools(pools)
	}

	setUpAccount = async (): Promise<string> => {
		// check our gas balance - if we have no balance then we need to send some tokens to it.
		const balanceCoin = await this.queryClient.getBalance(
			this.config.liquidatorAddress,
			this.config.gasDenom,
		)

		const balance = Number(balanceCoin.amount)

		// if less than min tokens, we need to top up
		if (balance < this.config.minGasTokens) {
			// send from our master to our liquidator
			const tokensToSend = this.config.minGasTokens - balance

			const result = await this.client.sendTokens(
				this.config.liquidatorMasterAddress,
				this.config.liquidatorAddress,
				[{ denom: this.config.gasDenom, amount: tokensToSend.toFixed(0) }],
				'auto',
			)

			if (result.code !== 0) {
				console.warn(
					`Failed to top up gas for liquidator ${this.config.liquidatorAddress}. Current balance: ${balance}${this.config.gasDenom}`,
				)
			}
		}

		let { tokens } = await this.queryClient.queryContractSmart(this.config.accountNftAddress, {
			tokens: { owner: this.config.liquidatorAddress },
		})

		if (tokens.length === 0) {
			const result = await this.client.signAndBroadcast(
				this.config.liquidatorAddress,
				[
					makeExecuteContractMessage(
						this.config.liquidatorAddress,
						this.config.creditManagerAddress,
						toUtf8(`{ "create_credit_account": {} }`),
					),
				],
				'auto',
			)

			if (result.code !== 0) {
				throw new Error(
					`Failed to create credit account for ${this.config.liquidatorAddress}. TxHash: ${result.transactionHash}`,
				)
			}
			// todo parse result to get sub account id
			const { tokens } = await this.queryClient.queryContractSmart(this.config.accountNftAddress, {
				tokens: { owner: this.config.liquidatorAddress },
			})

			return tokens[0]
		}

		return tokens[0]
	}

	run = async () => {
		// pop latest unhealthy position from the list
		const targetAccountId = await this.redis.popUnhealthyRoverAccountId()

		if (targetAccountId.length == 0) {
			//sleep to avoid spamming redis db when empty
			await sleep(200)
			console.log(' - No items for liquidation yet')
			return
		}
	}

	liquidate = async (accountId: string) => {
		const roverPosition = await fetchRoverPosition(
			accountId,
			this.config.creditManagerAddress,
			this.config.hiveEndpoint,
		)

		// find best collateral / debt
		const bestCollateral: Collateral = this.findBestCollateral(
			roverPosition.deposits,
			roverPosition.vaults,
		)

		const bestDebt: Debt = this.findBestDebt(
			roverPosition.debts.map((debtAmount) => {
				return { amount: debtAmount.amount, denom: debtAmount.denom }
			}),
		)

		//  - do message construction
		// borrow messages will include the swap if we cannot borrow debt asset directly
		const borrowActions = this.liquidationActionGenerator.produceBorrowActions(
			bestDebt,
			bestCollateral,
			this.markets,
			this.whitelistedCoins,
			this.creditLines,
			this.creditLineCaps,
		)

		const { borrow } = borrowActions[0] as { borrow: Coin }

		const liquidateMessage = this.liquidationActionGenerator.produceLiquidationAction(
			bestCollateral.type,
			{ denom: bestDebt.denom, amount: borrow.amount },
			roverPosition.account_id,
			bestCollateral.denom,
			bestCollateral.vaultType,
		)

		const vault = this.vaultDetails.get(bestCollateral.denom)

		const collateralToDebtActions = this.liquidationActionGenerator.convertCollateralToDebt(
			bestCollateral.denom,
			borrow,
			vault,
		)

		const repayMsg = this.liquidationActionGenerator.generateRepayActions(borrow.denom)

		// todo estimate amount based on repay to prevent slippage.
		// note : the actual msg does not use the amount passed here - it just swaps everything in the credit account
		// note 2 : The asset here will be debt, not collateral - as we swap all the collateral to debt asset above
		const swapToStableMsg =
			bestDebt.denom !== this.config.neutralAssetDenom
				? this.liquidationActionGenerator.generateSwapActions(
						bestDebt.denom,
						this.config.neutralAssetDenom,
						'100',
				  )
				: []

		const refundAll = this.liquidationActionGenerator.produceRefundAllAction()

		const actions = [
			...borrowActions,
			liquidateMessage,
			...collateralToDebtActions,
			...repayMsg,
			...swapToStableMsg,
			refundAll,
		]

		actions.forEach((action) => console.log(action))

		const msg = {
			update_credit_account: { account_id: this.liquidatorAccountId, actions },
		}

		const result = await this.client.signAndBroadcast(
			this.config.liquidatorAddress,
			[
				makeExecuteContractMessage(
					this.config.liquidatorAddress,
					this.config.creditManagerAddress,
					toUtf8(JSON.stringify(msg)),
				),
			],
			'auto',
		)

		if (result.code !== 0) {
			console.log(`Liquidation failed. TxHash: ${result.transactionHash}`)
		} else {
			console.log(`Liquidation successfull. TxHash: ${result.transactionHash}`)
			// todo parse and log events?
		}
	}

	findBestCollateral = (collaterals: Coin[], vaultPositions: VaultPosition[]): Collateral => {
		const largestCollateralCoin = collaterals
			.sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB))
			.pop()
		const largestCollateralVault = vaultPositions
			.sort(
				(vaultA, vaultB) =>
					this.calculateVaultValue(vaultA).value - this.calculateVaultValue(vaultB).value,
			)
			.pop()

		const bestCollateral: Coin | VaultPosition | undefined =
			this.calculateCoinValue(largestCollateralCoin) >
			this.calculateVaultValue(largestCollateralVault).value
				? largestCollateralCoin
				: largestCollateralVault

		if (!bestCollateral) throw new Error('Failed to find a collateral')

		const isVault = (bestCollateral as VaultPosition).vault !== undefined

		if (isVault) {
			const { value, type } = this.calculateVaultValue(bestCollateral as VaultPosition)
			return {
				amount: 0,
				value,
				denom: (bestCollateral as VaultPosition).vault.address,
				closeFactor: 0.5, // todo
				price: 0,
				type: PositionType.VAULT,
				vaultType: type,
			}
		}

		const amount = Number((bestCollateral as Coin).amount)
		const value = amount * (this.prices.get((bestCollateral as Coin).denom) || 0)

		return {
			amount,
			value,
			denom: (bestCollateral as Coin).denom,
			closeFactor: 0.5, // todo
			price: this.prices.get((bestCollateral as Coin).denom) || 0,
			type: PositionType.COIN,
		}
	}

	calculateCoinValue = (coin: Coin | undefined): number => {
		if (!coin) return 0

		const amountBn = new BigNumber(coin?.amount)
		const price = new BigNumber(this.prices.get(coin.denom) || 0)
		return amountBn.multipliedBy(price).toNumber()
	}

	calculateVaultSharesValue = (shares: BigNumber, vaultAddress: string): BigNumber => {
		const vault = this.vaultDetails.get(vaultAddress)
		if (!vault) throw new Error(UNSUPPORTED_VAULT)
		const positionLpShares = shares.multipliedBy(vault.lpShareToVaultShareRatio)
		const lpSharePrice = this.prices.get(vault.baseToken) || 0
		if (lpSharePrice === 0) throw new Error(UNSUPPORTED_ASSET)
		return positionLpShares.multipliedBy(lpSharePrice)
	}

	calculateVaultValue = (
		vault: VaultPosition | undefined,
	): { value: number; type: VaultPositionType } => {
		if (!vault) return { value: 0, type: 'l_o_c_k_e_d' }

		// VaultPositionAmounts can be either locking or unlocked, but we don't know what one
		// until runtime, hence ts-ignore is used

		//@ts-ignore
		const vaultAmountLocked: BigNumber = new BigNumber(vault.amount.locking.locked)

		//@ts-ignore
		const vaultAmountUnlocked: BigNumber = new BigNumber(vault.amount.unlocked)

		const unlockingAmounts: VaultUnlockingPosition[] = JSON.parse(
			//@ts-ignore
			JSON.stringify(vault.amount.locking.unlocking),
		)

		// Coin here will be an LP share
		const largestUnlocking: Coin | undefined = unlockingAmounts
			.sort(
				(unlockA: VaultUnlockingPosition, unlockB: VaultUnlockingPosition) =>
					this.calculateCoinValue(unlockA.coin) - this.calculateCoinValue(unlockB.coin),
			)
			.pop()?.coin

		const safeLocked = vaultAmountLocked.isNaN() ? new BigNumber(0) : vaultAmountLocked
		const safeUnlocked = vaultAmountUnlocked.isNaN() ? new BigNumber(0) : vaultAmountUnlocked

		const vaultAmount = safeLocked.isGreaterThan(safeUnlocked)
			? vaultAmountLocked
			: vaultAmountUnlocked

		let vaultType: VaultPositionType = safeLocked.isGreaterThan(safeUnlocked)
			? 'l_o_c_k_e_d'
			: 'u_n_l_o_c_k_e_d'

		const largestVaultValue = this.calculateVaultSharesValue(vaultAmount, vault.vault.address)

		const largestUnlockingValue = largestUnlocking
			? new BigNumber(largestUnlocking.amount).multipliedBy(
					this.prices.get(largestUnlocking.denom) || 0,
			  )
			: new BigNumber(0)

		if (largestVaultValue.isNaN() || largestUnlockingValue.isGreaterThan(largestVaultValue)) {
			vaultType = 'u_n_l_o_c_k_i_n_g'
		}

		const value = largestVaultValue.isGreaterThan(largestUnlockingValue)
			? largestVaultValue.toNumber()
			: largestUnlockingValue.toNumber()

		return { value, type: vaultType }
	}

	findBestDebt = (debts: Coin[]): Debt => {
		const largestDebt = debts
			.sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB))
			.pop()

		if (!largestDebt) throw new Error('Failed to find any debts')

		return {
			amount: Number((largestDebt as Coin).amount),
			denom: (largestDebt as Coin).denom,
			price: this.prices.get((largestDebt as Coin).denom) || 0,
		}
	}
}
