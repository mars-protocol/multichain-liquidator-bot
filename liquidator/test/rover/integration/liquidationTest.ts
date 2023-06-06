import {
	getWallet,
	produceExecuteContractMessage,
	produceSigningCosmWasmClient,
	produceSigningStargateClient,
	setPrice,
	sleep,
} from '../../../src/helpers'
import { createCreditAccount, updateCreditAccount } from './roverTestHelpers'
import {
	MarsCreditManagerClient,
	MarsCreditManagerQueryClient,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.client'
import { MarsAccountNftQueryClient } from 'marsjs-types/creditmanager/generated/mars-account-nft/MarsAccountNft.client'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { SigningStargateClient } from '@cosmjs/stargate'
import { RoverExecutor, RoverExecutorConfig } from '../../../src/rover/RoverExecutor'
import { makeCosmoshubPath } from '@cosmjs/amino'
import {
	Action,
	ActionCoin,
	Coin,
	VaultPositionType,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import { toUtf8 } from '@cosmjs/encoding'
import { TestConfig, testnetConfig } from './config'
import BigNumber from 'bignumber.js'
import { AMMRouter } from '../../../src/AmmRouter'
import { RedisInterface } from '../../../src/redis'

const runTests = async (testConfig: TestConfig) => {
	// Test results
	const results = {
		simpleCoin: false,
		marketDisabled: false,
		coinDisabled: false,
		creditLineExceeded: false,
		illiquidRedbank: false,
		lpTokenCollateral: false,
		lockedVault: false,
		unlockingVault: false,
		unlockedVault: false,
		coinBigger: false,
		vaultBigger: false,
		liquidateMany: false
	}

	const maxLiquidators  = 10
	const accountIndexes : number[] = Array.from(Array(maxLiquidators).keys())

	// set up master services + details
	const { client, cwClient, wallet} = await createServices(
		testConfig.rpcEndpoint,
		testConfig.creditManagerAddress,
		testConfig.accountNFTAddress,
		testConfig.seed,
		testConfig.prefix,
		accountIndexes
	)

	const masterAddress = (await wallet.getAccounts())[0].address
	const exec = new MarsCreditManagerClient(cwClient, masterAddress, testConfig.creditManagerAddress)

	console.log('Master account setup complete')

	console.log({ masterAddress })

	if (testConfig.seedRedbankRequired) {
		await seedRedbank(client, masterAddress, testConfig)
		console.log('Seeded redbank')
	}

	const config: RoverExecutorConfig = {
		redbankAddress: testConfig.redbankAddress,
		oracleAddress: testConfig.oracleAddress,
		swapperAddress: testConfig.swapperAddress,
		accountNftAddress: testConfig.accountNFTAddress,
		gasDenom: testConfig.gasDenom,
		hiveEndpoint: testConfig.hiveEndpoint,
		lcdEndpoint: testConfig.lcdEndpoint,
		liquidatorMasterAddress: masterAddress,
		creditManagerAddress: testConfig.creditManagerAddress,
		minGasTokens: 100000,
		logResults: true,
		neutralAssetDenom: testConfig.usdcDenom,
		redisEndpoint: '', // not required for integration tests
		poolsRefreshWindow: 60000,
		maxLiquidators,
		stableBalanceThreshold: 10000000
	}

	// Set up our liquidator
	const executorLiquidator = new RoverExecutor(config, client, cwClient, wallet)
	await executorLiquidator.initiateRedis()
	await executorLiquidator.refreshData()

	if (testConfig.tests.lockedVault) {
		results.lockedVault = await runLockedVaultTest(
			testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
			exec,
		)
	}

	if (testConfig.tests.lpTokenCollateral) {
		results.lpTokenCollateral = await lpCoinLiquidate(
			testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
			exec,
		)
	}

	if (testConfig.tests.unlockingVault) {
		results.unlockingVault = await runUnlockingVaultTest(
			testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
		)
	}

	if (testConfig.tests.simpleCoin) {
		results.simpleCoin = await runCoinBorrowTest(
			testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
		)
	}

	if (testConfig.tests.marketDisabled) {
		results.marketDisabled = await liquidateCoinWithMarketDisabled(
			testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
		)
	}

	if (testConfig.tests.illiquidRedbank) {
		results.illiquidRedbank = await runIlliquidRedbankTest(
			testConfig,
			client,
			executorLiquidator,
			masterAddress,
		)
	}

	if (testConfig.tests.creditLineExceeded) {
		results.creditLineExceeded = await runCreditLineExceededCoinTest(
			testConfig,
			client,
			executorLiquidator,
			masterAddress,
		)
	}

	if (testConfig.tests.coinDisabled) {
		results.coinDisabled = await nonWhitelistedCoinTest(
			testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
			exec,
		)
	}

	if (testConfig.tests.liquidateMany) {
		results.liquidateMany = await runLiquidateAllTest(
			testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config
		)
	}

	console.log('Finished All Test Cases')
	console.log({ results })
}

const runLiquidateAllTest = async (
	testConfig: TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: RoverExecutor,
	masterAddress: string,
	config: RoverExecutorConfig,
) : Promise<boolean> => {
	try {
		console.log('Starting liquidate multiple test')
		const queueName = process.env.LIQUIDATION_QUEUE_NAME!
		const redisClient = await new RedisInterface().connect()

		const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom)
		// Set up our liquidatees
		const amount = '100000'
		const victimAccountId1 = await createVictimCoinPosition(
			testConfig,
			client,
			masterAddress,
			[{ denom: 'uosmo', amount: '140000' }],
			{
				amount: amount,
				denom: 'uosmo',
			},
			{
				amount: new BigNumber(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
				denom: testConfig.atomDenom,
			},
		)

		const victimAccountId2 = await createVictimCoinPosition(
			testConfig,
			client,
			masterAddress,
			[{ denom: 'uosmo', amount: '140000' }],
			{
				amount: amount,
				denom: 'uosmo',
			},
			{
				amount: new BigNumber(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
				denom: testConfig.atomDenom,
			},
		)

		const victimAccountId3 = await createVictimCoinPosition(
			testConfig,
			client,
			masterAddress,
			[{ denom: 'uosmo', amount: '140000' }],
			{
				amount: amount,
				denom: 'uosmo',
			},
			{
				amount: new BigNumber(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
				denom: testConfig.atomDenom,
			},
		)

		const accountIds = [victimAccountId1, victimAccountId2, victimAccountId3]
		await redisClient.lPush(queueName, accountIds)

		await setPrice(
			cwClient,
			masterAddress,
			testConfig.atomDenom,
			estimatedPrice.multipliedBy(1.35).toFixed(6),
			config.oracleAddress,
		)

		await executor.start()
		
		let liquidated = false
		let startTime = Date.now()
		const second = 1000
		while (!liquidated && startTime + (20 * second) > Date.now()) {
			const healthFactorPromises = accountIds.map((accountId) => cwClient.queryContractSmart(testConfig.creditManagerAddress, {health: {account_id : accountId}}))
			const newHealthFactorResults = await Promise.all(healthFactorPromises)
			liquidated = (!newHealthFactorResults[0].liquidatable && !newHealthFactorResults[1].liquidatable && !newHealthFactorResults[2].liquidatable)

			if (liquidated) {
				console.log(newHealthFactorResults)
			}
		
			await sleep(1 * second)
		}

		if (!liquidated) {
			console.log('Failed to liquidate all positions')
		}
		console.log('Finished multi liquidation test')
		return liquidated
	} catch (e) {
		console.error(e)
		return false
	} finally {
		await resetPrice(
			testConfig.atomDenom,
			testConfig.oracleAddress,
			masterAddress,
			testConfig.osmoAtomPoolId,
			client,
		)
		process.exit(0)
	}
}

const runUnlockingVaultTest = async (
	testConfig: TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: RoverExecutor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	console.log('Starting unlocking vault test')
	try {
		const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom)

		const depositAmount = '10000'
		// // Set up our liquidatee
		const victimAccountId = await createVictimVaultPosition(
			testConfig,
			masterAddress,
			[{ denom: testConfig.gasDenom, amount: '110000' }],
			client,
			{ denom: testConfig.gasDenom, amount: depositAmount },
			{
				denom: testConfig.atomDenom,
				amount: new BigNumber(depositAmount).dividedBy(estimatedPrice).toFixed(0),
			},
			'u_n_l_o_c_k_i_n_g',
		)

		console.log('created vault position')

		await setPrice(
			cwClient,
			masterAddress,
			testConfig.atomDenom,
			estimatedPrice.multipliedBy(2).toFixed(6),
			config.oracleAddress,
		)
		await executor.liquidate(victimAccountId, masterAddress)
	} catch (e) {
		console.error(e)
		return false
	} finally {
		await resetPrice(
			testConfig.atomDenom,
			testConfig.oracleAddress,
			masterAddress,
			testConfig.osmoAtomPoolId,
			client,
		)
	}

	console.log('Finished vault test')
	return true
}

const runLockedVaultTest = async (
	testConfig: TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: RoverExecutor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	try {
		console.log('Testing locked vault')
		const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom)
		await exec.updateConfig({
			updates: {
				allowed_coins: [
					'uosmo',
					testConfig.usdcDenom,
					testConfig.atomDenom,
					testConfig.osmoAtomPoolDenom,
				],
			},
		})

		const depositAmount = '10000'
		// // Set up our liquidatee
		const victimAccountId = await createVictimVaultPosition(
			testConfig,
			masterAddress,
			[{ denom: testConfig.gasDenom, amount: '110000' }],
			client,
			{ denom: testConfig.gasDenom, amount: depositAmount },
			{
				denom: testConfig.atomDenom,
				amount: new BigNumber(depositAmount).dividedBy(estimatedPrice).toFixed(0),
			},
			'l_o_c_k_e_d',
		)

		console.log('created vault position')

		await setPrice(
			cwClient,
			masterAddress,
			testConfig.atomDenom,
			estimatedPrice.multipliedBy(2).toFixed(6),
			config.oracleAddress,
		)
		await executor.liquidate(victimAccountId, masterAddress)
		await resetPrice(
			testConfig.atomDenom,
			testConfig.oracleAddress,
			masterAddress,
			testConfig.osmoAtomPoolId,
			client,
		)
	} catch (e) {
		console.log(e)
		return false
	}

	console.log('Finished vault test')
	return true
}

const runCoinBorrowTest = async (
	testConfig: TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: RoverExecutor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	try {
		console.log('Starting simple coin test')

		const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom)

		// Set up our liquidatee
		const amount = '100000'
		const victimAccountId = await createVictimCoinPosition(
			testConfig,
			client,
			masterAddress,
			[{ denom: 'uosmo', amount: '140000' }],
			{
				amount: amount,
				denom: 'uosmo',
			},
			{
				amount: new BigNumber(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
				denom: 'uatom',
			},
		)

		await setPrice(
			cwClient,
			masterAddress,
			testConfig.atomDenom,
			estimatedPrice.multipliedBy(1.4).toFixed(6),
			config.oracleAddress,
		)
		await executor.liquidate(victimAccountId,masterAddress)

		console.log('Finished simple test')
	} catch (e) {
		console.error(e)
		return false
	} finally {
		await resetPrice(
			testConfig.atomDenom,
			testConfig.oracleAddress,
			masterAddress,
			testConfig.osmoAtomPoolId,
			client,
		)
	}
	return true
}

const lpCoinLiquidate = async (
	testConfig: TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: RoverExecutor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	try {
		console.log('Starting lpCoin test')
		await exec.updateConfig({
			updates: {
				allowed_coins: [
					'uosmo',
					testConfig.usdcDenom,
					testConfig.atomDenom,
					testConfig.osmoAtomPoolDenom,
				],
			},
		})

		// Set up our liquidatee.
		const { mnemonic } = await DirectSecp256k1HdWallet.generate(24)
		const {
			address: victimAddress,
			exec: vExec,
			nft: vNft,
		} = await createServices(
			testConfig.rpcEndpoint,
			testConfig.creditManagerAddress,
			testConfig.accountNFTAddress,
			mnemonic,
			testConfig.prefix,
		)

		const gammPriceMsg = {
			set_price_source: {
				denom: testConfig.osmoAtomPoolDenom,
				price_source: { xyk_liquidity_token: { pool_id: 1 } },
			},
		}

		// We want to estimate the pool price correctly, so that we can do the following
		// - provide the correct proportions to the pool
		// - increase the price the correct amount to liquidate
		const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom)

		const atomPriceMsg = {
			set_price_source: {
				denom: testConfig.atomDenom,
				price_source: { fixed: { price: estimatedPrice.toFixed(6) } },
			},
		}

		// Ensure prices are correct
		await client.signAndBroadcast(
			masterAddress,
			[
				produceExecuteContractMessage(
					masterAddress,
					testConfig.oracleAddress,
					toUtf8(JSON.stringify(gammPriceMsg)),
				),
				produceExecuteContractMessage(
					masterAddress,
					testConfig.oracleAddress,
					toUtf8(JSON.stringify(atomPriceMsg)),
				),
			],
			'auto',
		)

		const amount = '100000'
		const depositCoin = {
			amount: amount,
			denom: 'uosmo',
		}

		const borrowCoin = {
			amount: new BigNumber(amount).times(estimatedPrice).toFixed(0),
			denom: 'uatom',
		}

		await client.sendTokens(
			masterAddress,
			victimAddress,
			[{ amount: (Number(amount) * 1.1).toFixed(0), denom: 'uosmo' }],
			'auto',
		)

		const victimAccountId = await createCreditAccount(victimAddress, vNft, vExec)
		const liquidityCoins: ActionCoin[] = [
			// NOTE - Order of the coins matters.
			{ denom: borrowCoin.denom, amount: { exact: borrowCoin.amount } },
			{ denom: depositCoin.denom, amount: { exact: depositCoin.amount } },
		]
		const provideLiquidity: Action = {
			provide_liquidity: {
				coins_in: liquidityCoins,
				lp_token_out: testConfig.osmoAtomPoolDenom,
				minimum_receive: '1',
			},
		}

		await updateCreditAccount(
			[
				{
					deposit: depositCoin,
				},
				{
					borrow: borrowCoin,
				},
				provideLiquidity,
			],
			victimAccountId,
			vExec,
			[{ amount: depositCoin.amount, denom: 'uosmo' }],
		)

		await setPrice(
			cwClient,
			masterAddress,
			testConfig.atomDenom,
			estimatedPrice.multipliedBy(2).toFixed(6),
			config.oracleAddress,
		)

		await executor.refreshData()
		await executor.liquidate(victimAccountId, masterAddress)

		console.log('Finished simple test')
	} catch (e) {
		console.error(e)
		return false
	} finally {
		await resetPrice(
			testConfig.atomDenom,
			testConfig.oracleAddress,
			masterAddress,
			testConfig.osmoAtomPoolId,
			client,
		)
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})
	}
	return true
}

const liquidateCoinWithMarketDisabled = async (
	testConfig: TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: RoverExecutor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	try {
		console.log('Starting disabled market test')

		const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom)

		// Set up our liquidatee
		const amount = '100000'
		const victimAccountId = await createVictimCoinPosition(
			testConfig,
			client,
			masterAddress,
			[{ denom: 'uosmo', amount: '140000' }],
			{
				amount: amount,
				denom: 'uosmo',
			},
			{
				amount: new BigNumber(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
				denom: testConfig.atomDenom,
			},
		)

		// Disable borrow of debt asset before liquidation
		await updateMarketBorrow(
			client,
			masterAddress,
			testConfig.redbankAddress,
			testConfig.atomDenom,
			false,
		)

		// refresh market data
		await executor.refreshData()

		await setPrice(
			cwClient,
			masterAddress,
			testConfig.atomDenom,
			estimatedPrice.multipliedBy(1.4).toFixed(6),
			config.oracleAddress,
		)
		await executor.liquidate(victimAccountId, masterAddress)

		console.log('Completed market disabled test')
	} catch (e) {
		console.log(e)
		return false
	} finally {
		// Re enable borrow
		await updateMarketBorrow(
			client,
			masterAddress,
			testConfig.redbankAddress,
			testConfig.atomDenom,
			true,
		)
		await resetPrice(
			testConfig.atomDenom,
			testConfig.oracleAddress,
			masterAddress,
			testConfig.osmoAtomPoolId,
			client,
		)
	}
	return true
}

const runIlliquidRedbankTest = async (
	testConfig: TestConfig,
	client: SigningStargateClient,
	executor: RoverExecutor,
	masterAddress: string,
): Promise<boolean> => {
	try {
		console.log('Starting illiquid market test')
		const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom)

		// Set up our liquidatee
		const amount = '100000'
		const victimAccountId = await createVictimCoinPosition(
			testConfig,
			client,
			masterAddress,
			[{ denom: 'uosmo', amount: '140000' }],
			{
				amount: amount,
				denom: 'uosmo',
			},
			{
				amount: new BigNumber(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
				denom: testConfig.atomDenom,
			},
		)

		await executor.refreshData()

		// update price
		const priceMsg = {
			set_price_source: {
				denom: testConfig.atomDenom,
				price_source: {
					fixed: { price: estimatedPrice.multipliedBy(1.5).toFixed(6) },
				},
			},
		}
		// find market liquidity
		const marketLiquidity =
			executor.markets.find((marketInfo) => marketInfo.denom === testConfig.atomDenom)
				?.available_liquidity || 0

		// give creditline to master account, and borrow
		const creditLineMsg = {
			update_uncollateralized_loan_limit: {
				user: masterAddress,
				denom: testConfig.atomDenom,
				new_limit: '1000000000000',
			},
		}

		// borrow all assets to make market utilisation 100%
		const borrowAmount = (marketLiquidity - 100).toFixed(0)
		const borrowMessage = { borrow: { denom: testConfig.atomDenom, amount: borrowAmount } }

		console.log('updating tests')
		await client.signAndBroadcast(
			masterAddress,
			[
				produceExecuteContractMessage(
					masterAddress,
					testConfig.redbankAddress,
					toUtf8(JSON.stringify(creditLineMsg)),
				),
				produceExecuteContractMessage(
					masterAddress,
					testConfig.oracleAddress,
					toUtf8(JSON.stringify(priceMsg)),
				),
				produceExecuteContractMessage(
					masterAddress,
					testConfig.redbankAddress,
					toUtf8(JSON.stringify(borrowMessage)),
				),
			],
			'auto',
		)

		await executor.refreshData()

		await executor.liquidate(victimAccountId, masterAddress)

		// return assets
		console.log('Completed illiquid market test')
	} catch (e) {
		console.log(e)
		return false
	} finally {
		await resetPrice(
			testConfig.atomDenom,
			testConfig.oracleAddress,
			masterAddress,
			testConfig.osmoAtomPoolId,
			client,
		)
	}
	return true
}

const runCreditLineExceededCoinTest = async (
	testConfig: TestConfig,
	client: SigningStargateClient,
	executor: RoverExecutor,
	masterAddress: string
): Promise<boolean> => {
	try {
		console.log('Starting creditLine exceeded test')

		const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom)

		// Set up our liquidatee
		const amount = '100000'
		const victimAccountId = await createVictimCoinPosition(
			testConfig,
			client,
			masterAddress,
			[{ denom: 'uosmo', amount: '140000' }],
			{
				amount: amount,
				denom: 'uosmo',
			},
			{
				amount: new BigNumber(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
				denom: testConfig.atomDenom,
			},
		)

		// update price
		const priceMsg = {
			set_price_source: {
				denom: testConfig.atomDenom,
				price_source: {
					fixed: { price: estimatedPrice.multipliedBy(1.6).toFixed(6) },
				},
			},
		}

		// effectively remove credit line for debt asset (atom)
		const creditLineMsg = {
			update_uncollateralized_loan_limit: {
				user: testConfig.creditManagerAddress,
				denom: testConfig.atomDenom,
				// cannot set new limit to 0 if we have existing debt,
				new_limit: '1',
			},
		}

		await client.signAndBroadcast(
			masterAddress,
			[
				produceExecuteContractMessage(
					masterAddress,
					testConfig.redbankAddress,
					toUtf8(JSON.stringify(creditLineMsg)),
				),
				produceExecuteContractMessage(
					masterAddress,
					testConfig.oracleAddress,
					toUtf8(JSON.stringify(priceMsg)),
				),
			],
			'auto',
		)

		// refresh market data before liquidation
		await executor.refreshData()

		// todo fix tests
		await executor.liquidate(victimAccountId, masterAddress)

		console.log('Completed credit line exceeded test')
	} catch (e) {
		console.error(e)
		return false
	} finally {
		const resetAtomPriceMsg = {
			set_price_source: {
				denom: testConfig.atomDenom,
				price_source: {
					arithmetic_twap: { pool_id: testConfig.osmoAtomPoolId, window_size: 1800 },
				},
			},
		}
		// Reset credit line to be usable for next tests
		await client.signAndBroadcast(
			masterAddress,
			[
				produceExecuteContractMessage(
					masterAddress,
					testConfig.redbankAddress,
					toUtf8(
						JSON.stringify({
							update_uncollateralized_loan_limit: {
								user: testConfig.creditManagerAddress,
								denom: testConfig.atomDenom,
								new_limit: '10000000000',
							},
						}),
					),
				),
				produceExecuteContractMessage(
					masterAddress,
					testConfig.oracleAddress,
					toUtf8(JSON.stringify(resetAtomPriceMsg)),
				),
			],
			'auto',
		)
	}

	return true
}
const nonWhitelistedCoinTest = async (
	testConfig: TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: RoverExecutor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	try {
		console.log('Starting non whitelisted coin test')
		const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom)

		const victimAccount = await createVictimCoinPosition(
			testConfig,
			client,
			masterAddress,
			[{ denom: 'uosmo', amount: '1100000' }],
			{
				amount: '1000000',
				denom: 'uosmo',
			},
			{
				amount: '500000',
				denom: testConfig.atomDenom,
			},
		)

		await setPrice(
			cwClient,
			masterAddress,
			testConfig.atomDenom,
			estimatedPrice.multipliedBy(1.4).toFixed(6),
			config.oracleAddress,
		)

		// remove coin from whitelist
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom],
			},
		})

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount, masterAddress)
	} catch (e) {
		console.error(e)
		return false
	} finally {
		await resetPrice(
			testConfig.atomDenom,
			testConfig.oracleAddress,
			masterAddress,
			testConfig.osmoAtomPoolId,
			client,
		)
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})
	}
	return true
}

//////////////////////////////////////////////////////
// HELPERS BELOW

const createServices = async (
	rpcEndpoint: string,
	creditManagerAddress: string,
	accountNft: string,
	seed: string,
	prefix: string,
	accountIndexes: number[] = [0],
): Promise<{
	client: SigningStargateClient
	cwClient: SigningCosmWasmClient
	exec: MarsCreditManagerClient
	query: MarsCreditManagerQueryClient
	nft: MarsAccountNftQueryClient
	wallet: DirectSecp256k1HdWallet
	address: string
}> => {
	const wallet =
		accountIndexes.length === 1
			? await getWallet(seed, prefix)
			: await getWallet(seed, prefix, accountIndexes.map((index)=> makeCosmoshubPath(index)))

	const accounts = await wallet.getAccounts()
	const address = accounts[accountIndexes[0]].address

	const client = await produceSigningStargateClient(rpcEndpoint, wallet)
	const cwClient = await produceSigningCosmWasmClient(rpcEndpoint, wallet)

	const exec = new MarsCreditManagerClient(cwClient, address, creditManagerAddress)
	const query = new MarsCreditManagerQueryClient(cwClient, creditManagerAddress)
	const nft = new MarsAccountNftQueryClient(cwClient, accountNft)

	return {
		client,
		cwClient,
		exec,
		query,
		nft,
		wallet,
		address,
	}
}

const updateMarketBorrow = async (
	client: SigningStargateClient,
	masterAddress: string,
	redbankAddress: string,
	marketDenom: string,
	enabled: boolean,
): Promise<void> => {
	await client.signAndBroadcast(
		masterAddress,
		[
			produceExecuteContractMessage(
				masterAddress,
				redbankAddress,
				toUtf8(
					JSON.stringify({
						update_asset: {
							denom: marketDenom,
							params: {
								borrow_enabled: enabled,
							},
						},
					}),
				),
			),
		],
		'auto',
	)
}

const resetPrice = async (
	denom: string,
	oracleAddress: string,
	masterAddress: string,
	poolId: number,
	client: SigningStargateClient,
) => {
	const resetAtomPriceMsg = {
		set_price_source: {
			denom: denom,
			price_source: { arithmetic_twap: { pool_id: poolId, window_size: 1800 } },
		},
	}

	await client.signAndBroadcast(
		masterAddress,
		[
			produceExecuteContractMessage(
				masterAddress,
				oracleAddress,
				toUtf8(JSON.stringify(resetAtomPriceMsg)),
			),
		],
		'auto',
	)
}

const getEstimatedPoolPrice = (ammRouter: AMMRouter, assetDenom: string): BigNumber => {
	const amountOut = new BigNumber(1000000000)
	const osmoAtomRoute = ammRouter.getBestRouteGivenOutput(assetDenom, 'uosmo', amountOut)
	const estimatedPrice = amountOut.dividedBy(ammRouter.getRequiredInput(amountOut, osmoAtomRoute))
	return estimatedPrice
}
const seedRedbank = async (
	client: SigningStargateClient,
	masterAddress: string,
	testConfig: TestConfig,
) => {
	// seed redbank
	await client.signAndBroadcast(
		masterAddress,
		[
			produceExecuteContractMessage(
				masterAddress,
				testConfig.redbankAddress,
				toUtf8(JSON.stringify({ deposit: {} })),
				[
					{
						denom: 'uosmo',
						amount: '2000000',
					},
				],
			),
		],
		'auto',
	)
}

const createVictimVaultPosition = async (
	testConfig: TestConfig,

	masterAddress: string,
	coinsForVictim: Coin[],
	masterClient: SigningStargateClient,
	depositCoin: Coin,
	borrowCoin: Coin,
	vaultState: VaultPositionType,
): Promise<string> => {
	const { mnemonic } = await DirectSecp256k1HdWallet.generate(24)
	const {
		address: victimAddress,
		exec,
		nft: vNft,
	} = await createServices(
		testConfig.rpcEndpoint,
		testConfig.creditManagerAddress,
		testConfig.accountNFTAddress,
		mnemonic,
		testConfig.prefix,
	)

	await masterClient.sendTokens(masterAddress, victimAddress, coinsForVictim, 'auto')

	const victimAccountId = await createCreditAccount(victimAddress, vNft, exec)

	const liquidityCoins: ActionCoin[] = [
		// NOTE - Order of the coins matters.
		{ denom: borrowCoin.denom, amount: { exact: borrowCoin.amount } },
		{ denom: depositCoin.denom, amount: { exact: depositCoin.amount } },
	]

	if (vaultState === 'u_n_l_o_c_k_e_d') {
		throw new Error('Creating unlocked states currently not supported')
	}
	const vaultStateModifier: Action | undefined =
		vaultState === 'u_n_l_o_c_k_i_n_g'
			? {
					request_vault_unlock: {
						amount: '100000000000',
						vault: {
							address: testConfig.vaults[0],
						},
					},
			  }
			: undefined

	const actions: Action[] = [
		{
			deposit: depositCoin,
		},
		{
			borrow: borrowCoin,
		},
		{
			provide_liquidity: {
				coins_in: liquidityCoins,
				lp_token_out: testConfig.osmoAtomPoolDenom,
				minimum_receive: '1',
			},
		},
		{
			enter_vault: {
				coin: {
					denom: testConfig.osmoAtomPoolDenom,
					amount: 'account_balance',
				},
				vault: {
					address: testConfig.vaults[0],
				},
			},
		},
	]

	if (vaultStateModifier) {
		actions.push(vaultStateModifier)
	}

	await exec.updateCreditAccount({ accountId: victimAccountId, actions }, 'auto', undefined, [
		depositCoin,
	])

	return victimAccountId
}

const createVictimCoinPosition = async (
	testConfig: TestConfig,
	masterClient: SigningStargateClient,
	masterAddress: string,
	coinsForVictim: Coin[],
	depositCoin: Coin,
	borrowCoin: Coin,
): Promise<string> => {
	// Create our liquidatee
	const { mnemonic } = await DirectSecp256k1HdWallet.generate(24)
	const {
		address: victimAddress,
		exec: vExec,
		nft: vNft,
	} = await createServices(
		testConfig.rpcEndpoint,
		testConfig.creditManagerAddress,
		testConfig.accountNFTAddress,
		mnemonic,
		testConfig.prefix,
	)

	await masterClient.sendTokens(masterAddress, victimAddress, coinsForVictim, 'auto')

	const victimAccountId = await createCreditAccount(victimAddress, vNft, vExec)

	console.log({borrowCoin})
	// create fist victim - todo generalise this
	await updateCreditAccount(
		[
			{
				deposit: depositCoin,
			},
			{
				borrow: borrowCoin,
			},
			{
				withdraw: borrowCoin,
			},
		],
		victimAccountId,
		vExec,
		[{ amount: depositCoin.amount, denom: testConfig.gasDenom }],
	)

	return victimAccountId
}

const main = async () => {
	await runTests(testnetConfig)
}

main().then(() => process.exit())
