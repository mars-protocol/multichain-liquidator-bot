import { BaseExecutor, BaseConfig as BaseConfig } from '../BaseExecutor'
import {
	calculatePositionStateAfterPerpClosure,
	produceExecuteContractMessage,
	produceSendMessage,
	sleep,
} from '../helpers'
import { toUtf8 } from '@cosmjs/encoding'

import { ActionGenerator } from './ActionGenerator'
import {
	Addr,
	Coin,
	Positions,
	VaultPositionValue,
} from 'marsjs-types/mars-credit-manager/MarsCreditManager.types'
import BigNumber from 'bignumber.js'
import { MsgSendEncodeObject, SigningStargateClient } from '@cosmjs/stargate'
import { DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
import {
	AssetParamsBaseForAddr,
	PerpParams,
	VaultConfigBaseForString,
} from 'marsjs-types/mars-params/MarsParams.types'
import { RouteRequester } from '../query/routing/RouteRequesterInterface'
import { compute_health_js, HealthComputer } from 'mars-rover-health-computer-node'
import { TokensResponse } from 'marsjs-types/mars-account-nft/MarsAccountNft.types'
import { ChainQuery } from '../query/chainQuery'
import { HealthData } from 'mars-liquidation-node'

interface CreateCreditAccountResponse {
	tokenId: number
	liquidatorAddress: string
}

export interface RoverExecutorConfig extends BaseConfig {
	minGasTokens: number
	maxLiquidators: number
	stableBalanceThreshold: number
	usePerps: boolean
}

export class RoverExecutor extends BaseExecutor {
	private VAULT_RELOAD_WINDOW = 1800000
	public config: RoverExecutorConfig
	private liquidationActionGenerator: ActionGenerator

	private liquidatorAccounts: Map<string, number> = new Map()
	private liquidatorBalances: Map<string, Coin[]> = new Map()

	private lastFetchedVaultTime = 0

	private wallet: DirectSecp256k1HdWallet

	constructor(
		config: RoverExecutorConfig,
		client: SigningStargateClient,
		queryClient: ChainQuery,
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
		await this.init()

		// set up accounts
		const accounts = await this.wallet.getAccounts()
		// get liquidator addresses
		const liquidatorAddresses: string[] = accounts
			.slice(0, this.config.maxLiquidators)
			.map((account) => account.address)

		// initiate our wallets (in case they are not)
		await this.ensureWorkerMinBalance(liquidatorAddresses)
		// Fetch or create our credit accounts for each address

		const createCreditAccountpromises: Promise<CreateCreditAccountResponse>[] = []
		liquidatorAddresses.map((address) =>
			createCreditAccountpromises.push(this.getDefaultCreditAccount(address)),
		)

		const results: CreateCreditAccountResponse[] = await Promise.all(createCreditAccountpromises)
		results.forEach((result) =>
			this.liquidatorAccounts.set(result.liquidatorAddress, result.tokenId),
		)
		// We set up 3 separate tasks to run in parallel
		//
		// Periodically  fetch the different pieces of data we need,
		setInterval(this.init, 300 * 1000)
		// Ensure our liquidator wallets have more than enough funds to operate
		setInterval(this.updateLiquidatorBalances, 20 * 1000)
		// check for and dispatch liquidations
		while (true) {
			await this.run()
			await sleep(5000)
		}
	}

	run = async () => {
		try {
			let endpointPath =
				this.config.apiVersion === 'v1'
					? `v1/unhealthy_positions/${this.config.chainName}/${this.config.productName}`
					: `v2/unhealthy_positions?chain=${this.config.chainName}&product=${this.config.productName}`
			// Pop latest unhealthy positions from the list - cap this by the number of liquidators we have available
			const url = `${this.config.marsEndpoint!}/${endpointPath}`

			const response = await fetch(url)
			let targetAccountObjects: {
				account_id: string
				health_factor: string
				total_debt: string
			}[] = (await response.json())['data']

			const targetAccounts = targetAccountObjects
				.filter(
					(account) =>
						Number(account.health_factor) < Number(process.env.MAX_LIQUIDATION_LTV) &&
						Number(account.health_factor) > Number(process.env.MIN_LIQUIDATION_LTV),
					// To target specific accounts, filter here
				)
				.sort((accountA, accountB) => Number(accountB.total_debt) - Number(accountA.total_debt))
			// Sleep to avoid spamming.

			if (targetAccounts.length == 0) {
				console.log('No unhealthy accounts found. Sleeping for 5 seconds')
				await sleep(5000)
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
				const liquidationPromises: Promise<void>[] = []
				for (const account of chunk) {
					const nextLiquidator = liquidatorAddressesIterator.next()
					console.log('liquidating: ', account.account_id, ' with ', nextLiquidator.value)
					liquidationPromises.push(this.liquidate(account.account_id, nextLiquidator.value!))
				}
				await Promise.all(liquidationPromises)
				await sleep(4000)
			}
		} catch (ex) {
			if (process.env.DEBUG) {
				console.error(ex)
			}
		}
	}

	liquidate = async (accountId: string, liquidatorAddress: string) => {
		try {
			const account: Positions = await this.queryClient.queryPositionsForAccount(accountId)

			if (!this.config.usePerps) {
				// default to null if perps are not present
				account.perps = []
			}

			const hasPerps = account.perps.length > 0
			const updatedAccount: Positions = hasPerps
				? calculatePositionStateAfterPerpClosure(
						account,
						this.config.neutralAssetDenom,
						// We can use the account as is if we don't have any perps
				  )
				: account

			// Make prices safe for our wasm. If we just to string we
			// get things like 3.42558449e-9 which cannot be parsed
			// by the health computer
			let checkedPrices: Map<string, string> = new Map()
			this.prices.forEach((price, denom) => {
				checkedPrices.set(denom, price.toFixed(18))
			})

			let healthData = this.createHealthData(
				updatedAccount,
				checkedPrices,
				this.assetParams,
				this.perpParams,
			)
			const actions = await this.liquidationActionGenerator.generateLiquidationActions(
				this.config.chainName,
				updatedAccount,
				this.prices,
				this.markets,
				this.assetParams,
				healthData,
				this.config.neutralAssetDenom,
			)

			if (actions.length === 0) {
				return
			}

			const liquidatorAccountId = this.liquidatorAccounts.get(liquidatorAddress)!

			// Produce message
			const msg = {
				update_credit_account: {
					account_id: liquidatorAccountId.toString(),
					actions,
				},
			}

			const msgs: EncodeObject[] = [
				produceExecuteContractMessage(
					liquidatorAddress,
					this.config.contracts.creditManager,
					toUtf8(JSON.stringify(msg)),
				),
			]

			// Add a msg to send liquidators STABLE balance to master address. This will only send previously accrued
			// winnings, but not those from the current liquidation (if successfull)
			const liquidatorBalances = this.liquidatorBalances.get(liquidatorAddress)
			const stable = liquidatorBalances?.find(
				(coin) => coin.denom === this.config.neutralAssetDenom,
			)

			if (
				stable !== undefined &&
				new BigNumber(stable.amount).isGreaterThan(this.config.stableBalanceThreshold)
			) {
				const sendMsg = produceSendMessage(liquidatorAddress, this.config.liquidatorMasterAddress, [
					stable,
				])
				msgs.push(sendMsg)
			}

			const fee = await this.getFee(msgs, liquidatorAddress, this.config.chainName.toLowerCase())

			const result = await this.signingClient.signAndBroadcast(liquidatorAddress, msgs, fee)

			if (result.code !== 0) {
				console.log(`Liquidation failed. TxHash: ${result.transactionHash}`)
			} else {
				console.log(
					`Liquidation successfull. TxHash: ${result.transactionHash}, account : ${accountId}`,
				)
			}
		} catch (ex) {
			if (process.env.DEBUG) {
				console.error(ex)
			}
		}
	}

	/// Helpers

	createHealthData = (
		positions: Positions,
		prices: Map<string, string>,
		assetParams: Map<string, AssetParamsBaseForAddr>,
		perpParams: Map<string, PerpParams>,
	): HealthData => {
		positions.account_kind = "default"
		let hc: HealthComputer = {
			kind: 'default',
			positions: positions,
			asset_params: Object.fromEntries(assetParams),
			vaults_data: {
				vault_values: new Map<Addr, VaultPositionValue>(),
				vault_configs: new Map<Addr, VaultConfigBaseForString>(),
			},
			perps_data: {
				params: Object.fromEntries(perpParams),
			},
			oracle_prices: Object.fromEntries(prices),
		}

		const healthResponse = compute_health_js(hc)

		const accountNetValue = new BigNumber(healthResponse.total_collateral_value)
			.minus(healthResponse.total_debt_value)
			.toFixed(0)
		const collateralizationRatio =
			healthResponse.total_debt_value === '0'
				? new BigNumber(100000000) // Instead of `infinity` we use a very high number
				: new BigNumber(healthResponse.total_collateral_value)
						.dividedBy(new BigNumber(healthResponse.total_debt_value))
						.toFixed(0)

		const healthData: HealthData = {
			liquidation_health_factor: healthResponse.liquidation_health_factor,
			account_net_value: accountNetValue,
			collateralization_ratio: collateralizationRatio,
			perps_pnl_loss: healthResponse.perps_pnl_loss,
		}

		return healthData
	}

	updateLiquidatorBalances = async () => {
		const liquidatorAddresses = Array.from(this.liquidatorAccounts.keys())
		await this.ensureWorkerMinBalance(liquidatorAddresses)
	}

	ensureWorkerMinBalance = async (addresses: string[]) => {
		try {
			const sendMsgs: MsgSendEncodeObject[] = []
			const amountToSend = this.config.minGasTokens * 2

			for (const address of addresses) {
				let balancesResponse = await this.queryClient.queryBalance(address)
				// Update our balances with latest amounts
				this.liquidatorBalances.set(address, balancesResponse.balances)

				// Check gas balance, send more if required
				let gasDenomBalance = balancesResponse.balances.find(
					(coin) => coin.denom === this.config.gasDenom,
				)
				if (
					gasDenomBalance === undefined ||
					new BigNumber(gasDenomBalance.amount).isLessThan(this.config.minGasTokens)
				) {
					sendMsgs.push(
						produceSendMessage(this.config.liquidatorMasterAddress, address, [
							{ denom: this.config.gasDenom, amount: amountToSend.toFixed(0) },
						]),
					)
				}
			}

			if (sendMsgs.length > 0) {
				const fee = await this.getFee(
					sendMsgs,
					this.config.liquidatorMasterAddress,
					this.config.chainName.toLowerCase(),
				)
				await this.signingClient.signAndBroadcast(
					this.config.liquidatorMasterAddress,
					sendMsgs,
					fee,
				)
			}
		} catch (ex) {
			console.error(ex)
		} finally {
		}
	}

	init = async () => {
		try {
			// Periodically refresh the vaults we have
			const currentTimeMs = Date.now()
			if (this.lastFetchedVaultTime + this.VAULT_RELOAD_WINDOW < currentTimeMs) {
				this.lastFetchedVaultTime = currentTimeMs
			}

			await this.updateMarketsData()
			await this.updatePriceSources()
			await this.updateOraclePrices()
			if (this.config.usePerps) {
				await this.updatePerpParams()
			}
			await this.updateAssetParams()
		} catch (ex) {
			console.error('Failed to refresh data')
			console.error(JSON.stringify(ex))
		}
	}

	getDefaultCreditAccount = async (
		liquidatorAddress: string,
	): Promise<CreateCreditAccountResponse> => {
		let tokensResponse: TokensResponse = await this.queryClient.queryAccountsForAddress(
			liquidatorAddress,
		)

		let msgs = [
			produceExecuteContractMessage(
				liquidatorAddress,
				this.config.contracts.creditManager,
				toUtf8(`{ "create_credit_account": "default" }`),
			),
		]
		if (tokensResponse.tokens.length === 0) {
			const result = await this.signingClient.signAndBroadcast(
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
			const newTokensResponse = await this.queryClient.queryAccountsForAddress(liquidatorAddress)

			tokensResponse = newTokensResponse
		}

		return { liquidatorAddress, tokenId: Number(tokensResponse.tokens[0]) }
	}
}
