import { BaseExecutor, BaseExecutorConfig } from '../BaseExecutor'
import { calculatePositionStateAfterPerpClosure, produceExecuteContractMessage, produceSendMessage, sleep } from '../helpers'
import { toUtf8 } from '@cosmjs/encoding'
import { fetchBalances } from '../query/hive'
import { ActionGenerator } from './ActionGenerator'
import {
	Coin,
	Positions,
	VaultPosition,
	VaultPositionType,
	VaultUnlockingPosition,
} from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import { VaultInfo } from '../query/types'
import BigNumber from 'bignumber.js'
import { Collateral, Debt, PositionType } from './types/RoverPosition'
import { MsgSendEncodeObject, SigningStargateClient } from '@cosmjs/stargate'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { UNSUPPORTED_ASSET, UNSUPPORTED_VAULT } from './constants/errors'
import { DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import { QueryMsg, VaultConfigBaseForString } from 'marsjs-types/mars-params/MarsParams.types'
import { RouteRequester } from '../query/routing/RouteRequesterInterface'
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
	private liquidationActionGenerator: ActionGenerator

	private liquidatorAccounts: Map<string, number> = new Map()
	private liquidatorBalances : Map<string, Coin[]> = new Map()

	private vaultInfo: Map<string, VaultInfo> = new Map()
	private lastFetchedVaultTime = 0

	private wallet: DirectSecp256k1HdWallet

	constructor(
		config: RoverExecutorConfig,
		client: SigningStargateClient,
		queryClient: CosmWasmClient,
		wallet: DirectSecp256k1HdWallet,
		routeRequester: RouteRequester,
	) {
		super(config, client, queryClient, routeRequester)
		this.config = config
		this.liquidationActionGenerator = new ActionGenerator(routeRequester)
		this.wallet = wallet
	}

	// Entry to rover executor
	start = async () => {
		await this.refreshData()

		// set up accounts
		const accounts = await this.wallet.getAccounts()
		// get liquidator addresses
		const liquidatorAddresses: string[] = accounts
			.slice(0, this.config.maxLiquidators)
			.map((account) => account.address)

		// initiate our wallets (in case they are not)
		await this.ensureWorkerMinBalance(liquidatorAddresses)
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
			try {
				await this.run()
			} catch(ex) {
				console.error(ex)
			}
		}
	}

	run = async () => {

		// Pop latest unhealthy positions from the list - cap this by the number of liquidators we have available
		const url = `${this.config.marsEndpoint!}/v2/unhealthy_positions?chain=neutron&product=creditmanager`

		const response = await fetch(url);
		let targetAccountObjects: {
			account_id: string,
			health_factor: string,
			total_debt: string
		}[] = (await response.json())['data']

		const  targetAccounts = targetAccountObjects.filter(
			(account) =>
				Number(account.health_factor) < Number(process.env.MAX_LIQUIDATION_LTV) &&
				Number(account.health_factor) > Number(process.env.MIN_LIQUIDATION_LTV)
				// To target specific accounts, filter here
			)
			.sort((accountA, accountB)=> Number(accountB.total_debt) - Number(accountA.total_debt))
		// Sleep to avoid spamming.

		if (targetAccounts.length == 0) {
			await sleep(2000)
			return
		}

		// create chunks of accounts to liquidate
		const unhealthyAccountChunks = []
		for (let i = 0; i < targetAccounts.length; i += this.liquidatorAccounts.size) {
			unhealthyAccountChunks.push(targetAccounts.slice(i, i + this.liquidatorAccounts.size))
		}
		// iterate over chunks and liquidate
		for (const chunk of unhealthyAccountChunks) {
			const liquidatorAddressesIterator = this.liquidatorAccounts.keys()
			const liquidationPromises : Promise<void>[] = []
			for (const account of chunk) {
				const nextLiquidator = liquidatorAddressesIterator.next()
				console.log('liquidating: ', account.account_id, ' with ', nextLiquidator.value)
				liquidationPromises.push(this.liquidate(account.account_id, nextLiquidator.value!))
			}
			await Promise.all(liquidationPromises)
			await sleep(4000)
		}
	}

	liquidate = async (accountId: string, liquidatorAddress : string) => {
		try {
			const roverPosition: Positions = await this.queryClient.queryContractSmart(
				this.config.creditManagerAddress,
				{ positions: { account_id: accountId } }
			)
			const updatedPositions = calculatePositionStateAfterPerpClosure(roverPosition, this.config.neutralAssetDenom)

			// Find best collateral to claim
			const bestCollateral: Collateral = this.findBestCollateral(updatedPositions)

			// Find best debt to liquidate
			const bestDebt: Debt = this.findBestDebt(
				updatedPositions.debts.map((debtAmount) => {
					return { amount: debtAmount.amount, denom: debtAmount.denom }
				}),
			)

			//  - do message construction
			// borrow messages will include the swap if we cannot borrow debt asset directly
			const borrowActions = this.liquidationActionGenerator.produceBorrowActions(
				bestDebt,
				bestCollateral,
				this.markets,
			)

			// variables
			const { borrow } = borrowActions[0] as { borrow: Coin }
			// const swapWinnings = true
			const slippage =  process.env.SLIPPAGE ||  '0.005'

			const liquidateAction = this.liquidationActionGenerator.produceLiquidationAction(
				bestCollateral.type,
				{ denom: bestDebt.denom, amount: "0" },
				roverPosition.account_id,
				bestCollateral.denom,
				bestCollateral.vaultType,
			)
			const vault = this.vaultInfo.get(bestCollateral.denom)

			const collateralToDebtActions = bestCollateral.denom !== borrow.denom
				? await this.liquidationActionGenerator.convertCollateralToDebt(
					bestCollateral.denom,
					borrow,
					vault,
					slippage,
					this.prices
				)
				: []

			const repayMsg = this.liquidationActionGenerator.generateRepayActions(borrow.denom)
			// todo estimate amount based on repay to prevent slippage.
			// const swapToStableMsg = []
				// borrow.denom !== this.config.neutralAssetDenom && swapWinnings
				// 	? [
				// 		await this.liquidationActionGenerator.generateSwapActions(
				// 			borrow.denom,
				// 			this.config.neutralAssetDenom,
				// 			// todo estimate winnings
				// 			'100',
				// 			slippage
				// 	)]
				// 	: []
			// const refundAll = this.liquidationActionGenerator.produceRefundAllAction()

			const actions = [
				...borrowActions,
				liquidateAction,
				...collateralToDebtActions,
				...repayMsg,
				// ...swapToStableMsg,
				// refundAll,
			]
			if (process.env.DEBUG) {
				actions.forEach((action) => console.log(JSON.stringify(action)))
			}

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

			const fee = await this.getFee(msgs, this.config.liquidatorMasterAddress, this.config.chainName.toLowerCase())

			const result = await this.client.signAndBroadcast(
				liquidatorAddress,
				msgs,
				fee,
			)

			if (result.code !== 0) {
				console.log(`Liquidation failed. TxHash: ${result.transactionHash}`)
			} else {
				console.log(`Liquidation successfull. TxHash: ${result.transactionHash}, account : ${accountId}`)
			}
		} catch(ex) {
			if (process.env.DEBUG) {
				console.error(ex)
			}
		}
	}

	/// Helpers

	updateLiquidatorBalances = async () => {
		const liquidatorAddresses = Array.from(this.liquidatorAccounts.keys())
		await this.ensureWorkerMinBalance(liquidatorAddresses)
	}

	ensureWorkerMinBalance = async(addresses: string[]) => {
		try {
			const balances = await fetchBalances(this.queryClient, addresses, this.config.gasDenom)
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
				const fee = await this.getFee(sendMsgs, this.config.liquidatorMasterAddress, this.config.chainName.toLowerCase())
				await this.client.signAndBroadcast(this.config.liquidatorMasterAddress, sendMsgs, fee)
			}
		} catch(ex) {
			console.error(ex)
		} finally {}
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
				this.lastFetchedVaultTime = currentTimeMs
			}

			// TODO
			// // dispatch hive request and parse it
			// const roverData = await fetchRoverData(
			// 	this.config.hiveEndpoint,
			// 	this.config.liquidatorMasterAddress,
			// 	this.config.redbankAddress,
			// 	this.config.swapperAddress,
			// 	this.vaults,
			// 	this.config.marsParamsAddress,
			// )

			await this.refreshMarketData()
			await this.updatePriceSources()
			await this.updateOraclePrices()
			// roverData.masterBalance.forEach((coin) => this.balances.set(coin.denom, Number(coin.amount)))
			// this.vaultInfo = roverData.vaultInfo
		} catch(ex) {
			console.error('Failed to refresh data')
			console.error(JSON.stringify(ex))
		}
	}

	createCreditAccount = async (
		liquidatorAddress: string,
	): Promise<CreateCreditAccountResponse> => {

		let { tokens } = await this.queryClient.queryContractSmart(this.config.accountNftAddress, {
			tokens: { owner: liquidatorAddress },
		})
		let msgs = [
			produceExecuteContractMessage(
				liquidatorAddress,
				this.config.creditManagerAddress,
				toUtf8(`{ "create_credit_account": "default" }`),
			),
		]
		if (tokens.length === 0) {
			const result = await this.client.signAndBroadcast(
				liquidatorAddress,
				msgs,
				await this.getFee(msgs, liquidatorAddress, this.config.chainName.toLowerCase()),
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

	findBestCollateral = (positions: Positions): Collateral => {

		const largestDeposit = positions
				.deposits
				.sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB))
				.pop()

		const largestLend = positions
				.lends
				.sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB))
				.pop()

		const largestStakedLp = positions
				.staked_astro_lps
				.sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB))
				.pop()

		const largestCollateralVault = positions.vaults
			.sort(
				(vaultA, vaultB) =>
					this.calculateVaultValue(vaultA).value - this.calculateVaultValue(vaultB).value,
			)
			.pop()

		let bestCollateral: Coin | VaultPosition | undefined = largestDeposit
		let positionType = PositionType.DEPOSIT
		let vaultType = undefined

		if 	(largestLend && this.calculateCoinValue(largestLend) > this.calculateCoinValue(bestCollateral)) {
			positionType = PositionType.LEND
			bestCollateral = largestLend
		}

		if 	(largestStakedLp && this.calculateCoinValue(largestStakedLp) > this.calculateCoinValue(bestCollateral)) {
			positionType = PositionType.STAKED_ASTRO_LP
			bestCollateral = largestStakedLp
		}

		if 	(largestCollateralVault) {
			let vaultResult = this.calculateVaultValue(largestCollateralVault)
			if (vaultResult.value > this.calculateCoinValue(bestCollateral)) {
				positionType = PositionType.VAULT
				bestCollateral = largestCollateralVault;
				vaultType = vaultResult.type
			}
		}

		if (!bestCollateral) throw new Error('Failed to find a collateral')

		const denom = positionType === PositionType.VAULT 
				? (bestCollateral as VaultPosition).vault.address
				: (bestCollateral as Coin).denom
		const amount = Number(bestCollateral.amount)
		const value = this.prices.get(denom)?.multipliedBy(amount).toNumber() || 0

		return {
			amount,
			value,
			denom,
			closeFactor: 0.5, // todo
			price: this.prices.get(denom)?.toNumber() || 0,
			type: positionType,
			vaultType
		}
	}

	calculateCoinValue = (coin: Coin | undefined): number => {
		if (!coin) return 0
		const amountBn = new BigNumber(coin.amount)
		const price = new BigNumber(this.prices.get(coin.denom) || 0)
		return amountBn.multipliedBy(price).toNumber()
	}

	calculateVaultSharesValue = (shares: BigNumber, vaultAddress: string): BigNumber => {
		const vault = this.vaultInfo.get(vaultAddress)
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
			price: this.prices.get((largestDebt as Coin).denom)!,
		}
	}
}
