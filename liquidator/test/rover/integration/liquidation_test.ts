import {
	getWallet,
	makeExecuteContractMessage,
	produceSigningCosmWasmClient,
	produceSigningStargateClient,
	setPrice,
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
import { Executor, RoverExecutorConfig } from '../../../src/rover/executor'
import { makeCosmoshubPath } from '@cosmjs/amino'
import {
	Action,
	ActionCoin,
	Coin,
	VaultPositionType,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import { toUtf8 } from '@cosmjs/encoding'
import { config, TestConfig } from './config'

const runTests = async (testConfig : TestConfig) => {
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
	}
	// set up master services + details
	const { client, cwClient, address, wallet } = await createServices(
		testConfig.rpcEndpoint,
		testConfig.creditManagerAddress,
		testConfig.accountNFTAddress,
		testConfig.seed,
		testConfig.prefix,
	)

	const masterAddress = (await wallet.getAccounts())[0].address
	const exec = new MarsCreditManagerClient(cwClient, masterAddress, testConfig.creditManagerAddress)

	console.log('Master account setup complete')

	const config: RoverExecutorConfig = {
		redbankAddress: testConfig.redbankAddress,
		oracleAddress: testConfig.oracleAddress,
		swapperAddress: testConfig.swapperAddress,
		liquidatorAddress: address,
		accountNftAddress: testConfig.accountNFTAddress,
		gasDenom: testConfig.gasDenom,
        hiveEndpoint:testConfig.hiveEndpoint,
		lcdEndpoint: testConfig.lcdEndpoint,
		liquidatorMasterAddress: masterAddress,
		creditManagerAddress: testConfig.creditManagerAddress,
		minGasTokens: 100000,
		logResults: true,
		neutralAssetDenom: testConfig.usdcDenom,
		redisEndpoint: 'http://127.0.0.1:6379', // not required for integration tests
	}

	// Set up our liquidator
	const executorLiquidator = new Executor(config, client, cwClient)
	await executorLiquidator.initiate()
	const tokenId = await executorLiquidator.setUpAccount()
	executorLiquidator.liquidatorAccountId = tokenId
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
			exec,
		)
	}

	if (testConfig.tests.unlockedVault) {
		// TODO
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
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
		)
	}

	if (testConfig.tests.creditLineExceeded) {
		results.creditLineExceeded = await runCreditLineExceededCoinTest(
            testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
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

	if (testConfig.tests.coinBigger) {
		results.coinBigger = await coinLargerThanVaultTest(
            testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
			exec,
		)
	}

	if (testConfig.tests.vaultBigger) {
		results.vaultBigger = await vaultLargerThanCoinTest(
            testConfig,
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
			exec,
		)
	}

	console.log('Finished All Test Cases')
	console.log({ results })
}

const runUnlockingVaultTest = async (
    testConfig : TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	console.log('Starting unlocking vault test')
	try {
		console.log(exec.vaultsInfo)
		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '13', testConfig.oracleAddress)

		// // Set up our liquidatee
		const victimAccountId = await createVictimVaultPosition(
            testConfig,
			masterAddress,
			[{ denom: testConfig.gasDenom, amount: '110000' }],
			client,
			{ denom: testConfig.gasDenom, amount: '1300' },
			{ denom: testConfig.atomDenom, amount: '100' },
			'l_o_c_k_e_d',
		)

		console.log('created vault position')
		// set price at 0.5

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '22', config.oracleAddress)

		// set up liquidator
		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)
	} catch (e) {
		console.error(e)
		return false
	}

	console.log('Finished vault test')
	return true
}

const runLockedVaultTest = async (
    testConfig : TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	try {
		console.log('Testing locked vault')
		console.log(exec.sender)
		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '13', config.oracleAddress)

		// // Set up our liquidatee
		const victimAccountId = await createVictimVaultPosition(
            testConfig,
			masterAddress,
			[{ denom: testConfig.gasDenom, amount: '110000' }],
			client,
			{ denom: testConfig.gasDenom, amount: '1300' },
			{ denom: testConfig.atomDenom, amount: '100' },
			'l_o_c_k_e_d',
		)

		console.log('created vault position')
		// set price at 0.5

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '22', config.oracleAddress)

		// set up liquidator
		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)
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
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	try {
		console.log('Starting simple test')
		// Set up our liquidatee
		const victimAccountId = await createVictimCoinPosition(
            testConfig,
			client,
			masterAddress,
			[{ denom: 'uosmo', amount: '1100000' }],
			{
				amount: '100000',
				denom: 'uosmo',
			},
			{
				amount: '50000',
				denom: 'uatom',
			},
		)

		// set price at 0.5
		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1.4', config.oracleAddress)
		// set up liquidator

		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)
		console.log('Finished simple test')
	} catch (e) {
		console.error(e)
		return false
	}
	return true
}

const lpCoinLiquidate = async (
    testConfig : TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	try {
		console.log('Starting lpCoin test')
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom, testConfig.osmoAtomPoolDenom],
			},
		})
		// Set up our liquidatee
		const { mnemonic } = await DirectSecp256k1HdWallet.generate(24)
		const {
			address: victimAddress,
			exec: vExec,
			nft: vNft,
		} = await createServices(testConfig.rpcEndpoint, testConfig.creditManagerAddress, testConfig.accountNFTAddress, mnemonic, testConfig.prefix)
		const amount = '100000'
		const depositCoin = {
			amount: amount,
			denom: 'uosmo',
		}

		const borrowCoin = {
			amount: amount,
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

		// set price at 0.5
		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1.75', config.oracleAddress)
		await setPrice(cwClient, masterAddress, testConfig.osmoAtomPoolDenom, '0.000000025', config.oracleAddress)
		// set up liquidator

		await executor.refreshData()
		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})
		console.log('Finished simple test')
	} catch (e) {
		console.error(e)
		return false
	}
	return true
}

const liquidateCoinWithMarketDisabled = async (
    testConfig: TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	try {
		console.log('Starting disabled market test')
		await updateMarketBorrow(client, masterAddress, testConfig.redbankAddress, testConfig.atomDenom, true)

		// Victim2 is that same as the first, except we disable market before liquidation
		// disable market
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

		// set price at 0.5
		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1.4', config.oracleAddress)

		await updateMarketBorrow(client, masterAddress, testConfig.redbankAddress, testConfig.atomDenom, false)

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)
		await updateMarketBorrow(client, masterAddress, testConfig.redbankAddress, testConfig.atomDenom, true)
		console.log(await client.getAllBalances(config.liquidatorAddress))
		console.log('Completed market disabled test')
	} catch {
		return false
	}
	return true
}

const runIlliquidRedbankTest = async (
    testConfig : TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	try {
		console.log('Starting illiquid market test')
		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)

		// disable market
		const victimAccountId = await createVictimCoinPosition(
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

		await executor.refreshData()

		// update price
		const priceMsg = {
			set_price_source: {
				denom: testConfig.atomDenom,
				price_source: {
					fixed: { price: '1.6' },
				},
			},
		}
		// find market liquidity
		const marketLiquidity =
			executor.markets.find((marketInfo) => marketInfo.denom === testConfig.atomDenom)?.available_liquidity ||
			0

		// give creditline to master account, and borrow
		const creditLineMsg = {
			update_uncollateralized_loan_limit: {
				user: masterAddress,
				denom: testConfig.atomDenom,
				new_limit: '1000000000000',
			},
		}

		// const msgs = []

		// borrow all assets to make market utilisation 100%
		const borrowAmount = (marketLiquidity - 100).toFixed(0)
		const borrowMessage = { borrow: { denom: testConfig.atomDenom, amount: borrowAmount } }
		console.log(JSON.stringify(borrowMessage))
		await client.signAndBroadcast(
			masterAddress,
			[
				makeExecuteContractMessage(
					masterAddress,
					testConfig.redbankAddress,
					toUtf8(JSON.stringify(creditLineMsg)),
				),
				makeExecuteContractMessage(masterAddress, testConfig.oracleAddress, toUtf8(JSON.stringify(priceMsg))),
				// makeExecuteContractMessage(
				// 	masterAddress,
				// 	redbankAddress,
				// 	toUtf8(JSON.stringify(borrowMessage)),
				// ),
			],
			'auto',
		)

		await executor.refreshData()
		executor.markets = executor.markets.map((market) => {
			if (market.denom === testConfig.atomDenom) market.available_liquidity = 0
			return market
		})

		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)

		console.log(await client.getAllBalances(config.liquidatorAddress))
		// return assets
		console.log('Completed illiquid market test')
	} catch (e) {
		throw e
		return false
	}
	return true
}

const runCreditLineExceededCoinTest = async (
    testConfig : TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	try {
		console.log('Starting creditLine exceeded test')

		const victimAccount2 = await createVictimCoinPosition(
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

		// update price
		const priceMsg = {
			set_price_source: {
				denom: testConfig.atomDenom,
				price_source: {
					fixed: { price: '1.6' },
				},
			},
		}

		// give creditline to master account, and borrow
		const creditLineMsg = {
			update_uncollateralized_loan_limit: {
				user: testConfig.creditManagerAddress,
				denom: testConfig.atomDenom,
				// cannot set new limit to 0 if we have existing debt,
				new_limit: '10000000000',
			},
		}

		await client.signAndBroadcast(
			masterAddress,
			[
				makeExecuteContractMessage(
					masterAddress,
					testConfig.redbankAddress,
					toUtf8(JSON.stringify(creditLineMsg)),
				),
				makeExecuteContractMessage(masterAddress, testConfig.oracleAddress, toUtf8(JSON.stringify(priceMsg))),
			],
			'auto',
		)

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount2)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)

		// Reset credit line to be usable for next tests
		await client.signAndBroadcast(
			masterAddress,
			[
				makeExecuteContractMessage(
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
			],
			'auto',
		)
		console.log(await client.getAllBalances(config.liquidatorAddress))

		console.log('Completed credit line exceeded test')
	} catch (e) {
		console.error(e)
		return false
	}

	return true
}
const nonWhitelistedCoinTest = async (
    testConfig : TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	try {
		console.log('Starting non whitelisted coin test')
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})
		// Victim3 is that same as the first, except we remove debt coin from allowed coins before liquidation
		// reenable market
		// remove coin
		const victimAccount3 = await createVictimCoinPosition(
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

		// set price at 0.5
		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1.4', config.oracleAddress)

		// remove coin from whitelist
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo',testConfig. usdcDenom, testConfig.atomDenom],
			},
		})

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount3)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})
	} catch (e) {
		console.error(e)
		return false
	}
	return true
}

const coinLargerThanVaultTest = async (
    testConfig : TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	try {
		console.log('Starting non whitelisted coin test')
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})
		// Victim3 is that same as the first, except we remove debt coin from allowed coins before liquidation
		// reenable market
		// remove coin
		const victimAccount3 = await createVictimCoinPosition(
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

		// set price at 0.5
		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1.4', config.oracleAddress)

		// remove coin from whitelist
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount3)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})
	} catch {
		return false
	}
	return true
}
const vaultLargerThanCoinTest = async (
    testConfig : TestConfig,
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	try {
		console.log('Starting non whitelisted coin test')
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})
		// Victim3 is that same as the first, except we remove debt coin from allowed coins before liquidation
		// reenable market
		// remove coin
		const victimAccount3 = await createVictimCoinPosition(
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

		// set price at 0.5
		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1.4', config.oracleAddress)

		// remove coin from whitelist
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
			},
		})

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount3)

		await setPrice(cwClient, masterAddress, testConfig.atomDenom, '1', config.oracleAddress)
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo',testConfig.usdcDenom, testConfig.atomDenom],
			},
		})
	} catch {
		return false
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
	accountIndex: number = 0,
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
		accountIndex === 0
			? await getWallet(seed, prefix)
			: await getWallet(seed, prefix, [makeCosmoshubPath(0), makeCosmoshubPath(accountIndex)])

	const accounts = await wallet.getAccounts()
	const address = accounts[accountIndex].address

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
			makeExecuteContractMessage(
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

const createVictimVaultPosition = async (
    testConfig : TestConfig,

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
	} = await createServices(testConfig.rpcEndpoint, testConfig.creditManagerAddress, testConfig.accountNFTAddress, mnemonic, testConfig.prefix)

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
						amount: '999988',
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

	console.log({ victimAccountId })
	return victimAccountId
}

const createVictimCoinPosition = async (
    testConfig : TestConfig,
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
	} = await createServices(testConfig.rpcEndpoint, testConfig.creditManagerAddress, testConfig.accountNFTAddress, mnemonic, testConfig.prefix)

	await masterClient.sendTokens(masterAddress, victimAddress, coinsForVictim, 'auto')

	const victimAccountId = await createCreditAccount(victimAddress, vNft, vExec)

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
	await runTests(config)
}

main().then(() => process.exit())
