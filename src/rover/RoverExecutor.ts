import { BaseExecutor, BaseConfig as BaseConfig } from '../BaseExecutor'
import { calculatePositionStateAfterPerpClosure, produceExecuteContractMessage, produceSendMessage, sleep } from '../helpers'
import { toUtf8 } from '@cosmjs/encoding'
import { fetchBalances } from '../query/hive'
import { ActionGenerator } from './ActionGenerator'
import {
	Coin,
	Positions,
} from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import BigNumber from 'bignumber.js'
import { MsgSendEncodeObject, SigningStargateClient } from '@cosmjs/stargate'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import { QueryMsg, VaultConfigBaseForString } from 'marsjs-types/mars-params/MarsParams.types'
import { RouteRequester } from '../query/routing/RouteRequesterInterface'
interface CreateCreditAccountResponse {
	tokenId : number
	liquidatorAddress : string
}

export interface RoverExecutorConfig extends BaseConfig {
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
		// Periodically  fetch the different pieces of data we need,
		setInterval(this.refreshData, 30*1000)
		// Ensure our liquidator wallets have more than enough funds to operate
		setInterval(this.updateLiquidatorBalances, 20*1000)
		// check for and dispatch liquidations
		setInterval(this.run, 1000)
	}

	run = async () => {

		// Pop latest unhealthy positions from the list - cap this by the number of liquidators we have available
		const url = `${this.config.marsEndpoint!}/v2/unhealthy_positions?chain=${this.config.chainName}&product=${this.config.productName}`

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
			const account: Positions = await this.queryClient.queryContractSmart(
				this.config.creditManagerAddress,
				{ positions: { account_id: accountId } }
			)

			const updatedAccount: Positions = calculatePositionStateAfterPerpClosure(account, this.config.neutralAssetDenom)

			const actions = this.liquidationActionGenerator.generateLiquidationActions(updatedAccount, this.prices, this.markets)

			const liquidatorAccountId = this.liquidatorAccounts.get(liquidatorAddress)

			// Produce message 
			const msg = {
				update_credit_account: { 
					account_id: liquidatorAccountId, 
					actions 
				},
			}

			const msgs : EncodeObject[] = [
				produceExecuteContractMessage(
					liquidatorAddress,
					this.config.creditManagerAddress,
					toUtf8(JSON.stringify(msg)),
				),
			]

			// Add a msg to send liquidators STABLE balance to master address. This will only send previously accrued 
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
}
