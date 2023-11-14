import { BaseExecutor, BaseExecutorConfig } from '../BaseExecutor'
import { produceExecuteContractMessage, produceSendMessage, sleep } from '../helpers'
import { toUtf8 } from '@cosmjs/encoding'
import { fetchBalances, fetchRoverData, fetchRoverPosition } from '../query/hive'
import { LiquidationActionGenerator } from './LiquidationActionGenerator'
import {
	Coin,
	VaultPosition,
	VaultPositionType,
	VaultUnlockingPosition,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import { VaultInfo } from '../query/types'
import { PriceResponse } from 'marsjs-types/creditmanager/generated/mars-mock-oracle/MarsMockOracle.types'
import BigNumber from 'bignumber.js'
import { Collateral, Debt, PositionType } from './types/RoverPosition'
import { MsgSendEncodeObject, SigningStargateClient } from '@cosmjs/stargate'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { UNSUPPORTED_ASSET, UNSUPPORTED_VAULT } from './constants/errors'
import {
	UncollateralizedLoanLimitResponse,
	UserDebtResponse,
} from 'marsjs-types/redbank/generated/mars-red-bank/MarsRedBank.types'
import { DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import { PoolDataProviderInterface } from '../query/amm/PoolDataProviderInterface'
import { QueryMsg, VaultConfigBaseForString } from 'marsjs-types/redbank/generated/mars-params/MarsParams.types'


interface CreateCreditAccountResponse {
	tokenId : number
	liquidatorAddress : string
}

export interface RoverExecutorConfig extends BaseExecutorConfig {
	creditManagerAddress: string
	swapperAddress: string
	accountNftAddress: string
	minGasTokens: number
	maxLiquidators: number
	stableBalanceThreshold : number
}
export class RoverExecutor extends BaseExecutor {
	private VAULT_RELOAD_WINDOW = 1800000
	public config: RoverExecutorConfig
	private liquidationActionGenerator: LiquidationActionGenerator
	private creditLines: UserDebtResponse[] = []
	private creditLineCaps: UncollateralizedLoanLimitResponse[] = []

	private liquidatorAccounts: Map<string, number> = new Map()
	private liquidatorBalances : Map<string, Coin[]> = new Map()

	private whitelistedCoins: string[] = []
	private vaults: string[] = []
	private vaultDetails: Map<string, VaultInfo> = new Map()
	private lastFetchedVaultTime = 0

	private wallet: DirectSecp256k1HdWallet

	constructor(
		config: RoverExecutorConfig,
		client: SigningStargateClient,
		queryClient: CosmWasmClient,
		wallet: DirectSecp256k1HdWallet,
		poolProvider: PoolDataProviderInterface,
	) {
		super(config, client, queryClient, poolProvider)
		this.config = config
		this.liquidationActionGenerator = new LiquidationActionGenerator(this.ammRouter)
		this.wallet = wallet
	}

	// Entry to rover executor
	start = async () => {
		await this.initiateRedis()
		await this.initiateAstroportPoolProvider()
		await this.refreshData()
		
		// set up accounts
		const accounts = await this.wallet.getAccounts()

		// get liquidator addresses
		const liquidatorAddresses: string[] = accounts
			.slice(1, this.config.maxLiquidators + 1)
			.map((account) => account.address)

		// initiate our wallets (in case they are not)
		await this.topUpWallets(liquidatorAddresses)
		
		// Fetch or create our credit accounts for each address

		const createCreditAccountpromises : Promise<CreateCreditAccountResponse>[] = []
		liquidatorAddresses.map((address)=> createCreditAccountpromises.push(this.createCreditAccount(address)))
		
		const results : CreateCreditAccountResponse[] = await Promise.all(createCreditAccountpromises)
		results.forEach((result)=>this.liquidatorAccounts.set(result.liquidatorAddress, result.tokenId))

		// We set up 3 separate tasks to run in parallel
		//
		// Refresh the data such as pool data, vaults,
		setInterval(this.refreshData, 30*1000)
		// Ensure our liquidator wallets have more than enough funds to operate
		setInterval(this.updateLiquidatorBalances, 20*1000)
		// check for and dispatch liquidations
		while (true) {
			await sleep(200)
			await this.run()
		}
	}

	
	updateLiquidatorBalances = async () => {
		const liquidatorAddresses = Array.from(this.liquidatorAccounts.keys())
		await this.topUpWallets(liquidatorAddresses)
	}

	topUpWallets = async(addresses: string[]) => {
		try {
			const balances = await fetchBalances(this.config.hiveEndpoint, addresses)
			this.liquidatorBalances= balances
			const sendMsgs : MsgSendEncodeObject[] = []
			
			const amountToSend = this.config.minGasTokens * 2
	
			for (const address of Array.from(balances.keys())) {
				const osmoBalance = Number(balances.get(address)?.find((coin : Coin) => coin.denom === this.config.gasDenom)?.amount || 0)
	
				if (osmoBalance === undefined || osmoBalance < this.config.minGasTokens) {
					// send message to send gas tokens to our liquidator
					sendMsgs.push(produceSendMessage(this.config.liquidatorMasterAddress,address, [{denom: this.config.gasDenom, amount : amountToSend.toFixed(0)}]))
				}
			}
	
			if (sendMsgs.length > 0) {
				await this.client.signAndBroadcast(this.config.liquidatorMasterAddress, sendMsgs, 'auto')
				console.log(`topped up ${sendMsgs.length} wallets`)
			}
		} catch(ex) {
			console.error(JSON.stringify(ex))
		}
		
	}

	fetchVaults = async () => {
		let foundAll = false
		const limit = 5
		let vaults: VaultConfigBaseForString[] = []
		let startAfter: string | undefined = undefined
		while (!foundAll) {
			const vaultQuery: QueryMsg = {
				all_vault_configs: {
					limit, 
					start_after: startAfter,
				},
			}

			const results: VaultConfigBaseForString[] = await this.queryClient.queryContractSmart(
				this.config.marsParamsAddress,
				vaultQuery,
			)

			vaults = vaults.concat(results)

			if (results.length < limit) {
				foundAll = true
			}

			startAfter = results.pop()?.addr
		}

		return vaults
	}

	refreshData = async () => {
		try {
			// Periodically refresh the vaults we have
			const currentTimeMs = Date.now()
			if (this.lastFetchedVaultTime + this.VAULT_RELOAD_WINDOW < currentTimeMs) {
				const vaultsData: VaultConfigBaseForString[] = await this.fetchVaults()
				this.vaults = vaultsData.map((vaultData) => vaultData.addr)
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

			await this.refreshMarketData()

			roverData.masterBalance.forEach((coin) => this.balances.set(coin.denom, Number(coin.amount)))
			roverData.prices.forEach((price: PriceResponse) =>
				this.prices.set(price.denom, Number(price.price)),
			)
			this.whitelistedCoins = roverData.whitelistedAssets! as string[]

			this.vaultDetails = roverData.vaultInfo
			this.creditLines = roverData.creditLines
			this.creditLineCaps = roverData.creditLineCaps

			this.liquidationActionGenerator.setSwapperRoutes(roverData.routes)

			await this.refreshPoolData()
		} catch(ex) {
			console.error(JSON.stringify(ex))
		}
	}

	createCreditAccount = async (
		liquidatorAddress: string,
	): Promise<CreateCreditAccountResponse> => {

		let { tokens } = await this.queryClient.queryContractSmart(this.config.accountNftAddress, {
			tokens: { owner: liquidatorAddress },
		})

		if (tokens.length === 0) {
			const result = await this.client.signAndBroadcast(
				liquidatorAddress,
				[
					produceExecuteContractMessage(
						liquidatorAddress,
						this.config.creditManagerAddress,
						toUtf8(`{ "create_credit_account": "default" }`),
					),
				],
				'auto',
			)

			if (result.code !== 0) {
				throw new Error(
					`Failed to create credit account for ${liquidatorAddress}. TxHash: ${result.transactionHash}`,
				)
			}

			// todo parse result to get sub account id
			const { tokens: updatedTokens } = await this.queryClient.queryContractSmart(
				this.config.accountNftAddress,
				{
					tokens: { owner: liquidatorAddress },
				},
			)

			tokens = updatedTokens
		}

		return { liquidatorAddress, tokenId: tokens[0] }
	}

	run = async () => {

		// Pop latest unhealthy positions from the list - cap this by the number of liquidators we have available
		const targetAccounts : string[] = await this.redis.popUnhealthyPositions<string>(this.config.maxLiquidators-1)


		// Sleep to avoid spamming redis db when empty.
		if (targetAccounts.length == 0) {
			await sleep(200)
			return
		}

		// Dispatch our liquidations 
		const liquidatorAddressesIterator = this.liquidatorAccounts.keys()
		const liquidationPromises : Promise<void>[] = []
		for (const targetAccount of targetAccounts) {
			const next = liquidatorAddressesIterator.next()
			const liquidatorAddress : string = next.value
			liquidationPromises.push(this.liquidate(targetAccount, liquidatorAddress))
		}

		await Promise.all(liquidationPromises)
	}

	liquidate = async (accountId: string, liquidatorAddress : string) => {
		const roverPosition = await fetchRoverPosition(
			accountId,
			this.config.creditManagerAddress,
			this.config.hiveEndpoint,
		)

		// find best collateral / debt
		const bestCollateral: Collateral = this.findBestCollateral(
			roverPosition.deposits,
			roverPosition.lends,
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

		// variables
		const { borrow } = borrowActions[0] as { borrow: Coin }
		const swapWinnings = (bestDebt.amount * this.prices.get(bestDebt.denom)!) > 1000000
		const slippage =  process.env.SLIPPAGE ||  '0.005'

		const liquidateMessage = this.liquidationActionGenerator.produceLiquidationAction(
			bestCollateral.type,
			{ denom: bestDebt.denom, amount: borrow.amount },
			roverPosition.account_id,
			bestCollateral.denom,
			bestCollateral.vaultType,
		)

		const vault = this.vaultDetails.get(bestCollateral.denom)

		const collateralToDebtActions = bestCollateral.denom !== borrow.denom 
			? this.liquidationActionGenerator.convertCollateralToDebt(
				bestCollateral.denom,
				borrow,
				vault,
				slippage
			)
			: []

		const repayMsg = this.liquidationActionGenerator.generateRepayActions(borrow.denom)

		// todo estimate amount based on repay to prevent slippage.
		// note : the actual msg does not use the amount passed here - it just swaps everything in the credit account
		// note 2 : The asset here will be the coin we borrowed, not collateral - as we swap all the collateral to debt asset above
		const swapToStableMsg =
			borrow.denom !== this.config.neutralAssetDenom && swapWinnings
				? this.liquidationActionGenerator.generateSwapActions(
						borrow.denom,
						this.config.neutralAssetDenom,
						'10000000',
						slippage
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

		const liquidatorAccountId = this.liquidatorAccounts.get(liquidatorAddress)
		const msg = {
			update_credit_account: { account_id: liquidatorAccountId, actions },
		}

		const msgs : EncodeObject[] = [
			produceExecuteContractMessage(
				liquidatorAddress,
				this.config.creditManagerAddress,
				toUtf8(JSON.stringify(msg)),
			),
		]
		
		// add msg to send liquidators STABLE balance to master address. This will only send previously accrued 
		// winnings, but not those from the current liquidation (if successfull)
		const liquidatorBalances = this.liquidatorBalances.get(liquidatorAddress)
		const stable = liquidatorBalances?.find((coin)=> coin.denom === this.config.neutralAssetDenom)

		if (stable!== undefined && new BigNumber(stable.amount).isGreaterThan(this.config.stableBalanceThreshold)) {
			const sendMsg = produceSendMessage(liquidatorAddress, this.config.liquidatorMasterAddress, [stable])
			msgs.push(sendMsg)
		}
		
		const result = await this.client.signAndBroadcast(
			liquidatorAddress,
			msgs,
			'auto',
		)

		if (result.code !== 0) {
			console.log(`Liquidation failed. TxHash: ${result.transactionHash}`)
		} else {
			console.log(`Liquidation successfull. TxHash: ${result.transactionHash}`)
		}
	}

	findBestCollateral = (deposits: Coin[], lends: Coin[], vaultPositions: VaultPosition[]): Collateral => {

		const largestDeposit = deposits
			.sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB))
			.pop()

		const largestLend = lends
			.sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB))
			.pop()
		
		const largestCollateralCoin = this.calculateCoinValue(largestDeposit) > this.calculateCoinValue(largestLend) 
			? largestDeposit
			: largestLend


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
			type: largestDeposit === largestCollateralCoin ? PositionType.DEPOSIT : PositionType.LEND,
		}
	}

	calculateCoinValue = (coin: Coin | undefined): number => {
		if (!coin) return 0

		const amountBn = new BigNumber(coin.amount)
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
