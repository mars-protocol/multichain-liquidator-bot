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

const testConfig = {
	simpleCoin: false,
	marketDisabled: false,
	coinDisabled: false,
    lpTokenCollateral: true,
	creditLineExceeded: false,
	illiquidRedbank: false,
	lockedVault: false,
	unlockingVault: false,
	unlockedVault: false,
	coinBigger: false, // todo
	vaultBigger: false, // todo
}
// const atomDenom = 'uatom'

const gammPool1 = 'gamm/pool/1'

// const uosmo = 'uosmo'
const atomDenom = 'uatom'
// const udig = 'ibc/307E5C96C8F60D1CBEE269A9A86C0834E1DB06F2B3788AE4F716EDB97A48B97D'
// const ujuno = 'ujuno'
// const gammPool497 = 'gamm/pool/497'
const usdcDenom = 'usdc'

const vaultOsmoAtom1 = 'osmo14c43j37uymeqtauuzzrmdzle2w2v5xxygwqvqkvspgce0n5wztxqyzye7a'

const seed =
	'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius'

const accountNft = 'osmo1cljmlh9ctfv00ug9m3ndrsyyyfqlxnx4welnw8upgu6ylhd6hk4qchm9rt'
const creditManagerAddress = 'osmo1jyxsvevhu5dq6sqnrv446484jstmdcaahqldc29ukeknf6kk37uq6nvhlc'
const rpcEndpoint = 'http://127.0.0.1:26657'
const prefix = 'osmo'
const redbankAddress = 'osmo1suhgf5svhu4usrurvxzlgn54ksxmn8gljarjtxqnapv8kjnp4nrsll0sqv'
const oracleAddress = 'osmo1ghd753shjuwexxywmgs4xz7x2q732vcnkm6h2pyv9s6ah3hylvrqgj4mrx'

const testLiquidations = async () => {
	// set up master services + details
	const { client, cwClient, address, wallet } = await createServices(
		rpcEndpoint,
		creditManagerAddress,
		accountNft,
		seed,
		prefix,
		1,
	)

	const masterAddress = (await wallet.getAccounts())[0].address
	const exec = new MarsCreditManagerClient(cwClient, masterAddress, creditManagerAddress)

	console.log('Master account setup complete')

	console.log({ masterAddress })

	// seed redbank
	// const depositMsgs: MsgExecuteContractEncodeObject[] = ['uosmo', atomDenom].map(
	// 	(denom) =>
	// 		makeDepositMessage(masterAddress, redbankAddress, [
	// 			{
	// 				denom,
	// 				amount: '5000000',
	// 			},
	// 		]),
	// )

	// await client.signAndBroadcast(masterAddress, depositMsgs, 'auto')

	console.log('Seeded redbank')
	await setPrice(cwClient, masterAddress, atomDenom, '1', oracleAddress)

	const config: RoverExecutorConfig = {
		redbankAddress,
		oracleAddress,
		liquidatorAddress: address,
		accountNftAddress: accountNft,
		gasDenom: 'uosmo',
		hiveEndpoint: 'http://127.0.0.1:8085/graphql',
		lcdEndpoint: 'http://127.0.0.1:1317',
		liquidatorMasterAddress: masterAddress,
		creditManagerAddress,
		minGasTokens: 100000,
		logResults: true,
		neutralAssetDenom: usdcDenom,
		redisEndpoint: 'http://127.0.0.1:6379', // not required for integration tests
	}

	// Set up our liquidator
	const executorLiquidator = new Executor(config, client, cwClient)
	await executorLiquidator.initiate()
	const tokenId = await executorLiquidator.setUpAccount()
	executorLiquidator.liquidatorAccountId = tokenId
	await executorLiquidator.refreshData()
    

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
		coinBigger: false, // todo
		vaultBigger: false, // todo
	}

	if (testConfig.lockedVault) {
		results.lockedVault = await runLockedVaultTest(
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
			exec,
		)
	}

    if (testConfig.lpTokenCollateral) {
        results.lpTokenCollateral = await lpCoinLiquidate(
            cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
            exec
        )
    }

	if (testConfig.unlockingVault) {
		results.unlockedVault = await runUnlockingVaultTest(
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
			exec,
		)
	}

	if (testConfig.unlockedVault) {
		// TODO
	}

	if (testConfig.simpleCoin) {
		results.simpleCoin = await runCoinBorrowTest(
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
		)
	}

	if (testConfig.marketDisabled) {
		results.marketDisabled = await liquidateCoinWithMarketDisabled(
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
		)
	}

	if (testConfig.illiquidRedbank) {
		results.illiquidRedbank = await runIlliquidRedbankTest(
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
		)
	}

	if (testConfig.creditLineExceeded) {
		results.creditLineExceeded = await runCreditLineExceededCoinTest(
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
		)
	}

	if (testConfig.coinDisabled) {
		results.coinDisabled = await nonWhitelistedCoinTest(
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
			exec,
		)
	}

	if (testConfig.coinBigger) {
		results.coinBigger = await coinLargerThanVaultTest(
			cwClient,
			client,
			executorLiquidator,
			masterAddress,
			config,
			exec,
		)
	}

	if (testConfig.vaultBigger) {
		results.vaultBigger = await vaultLargerThanCoinTest(
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
		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)

		// // Set up our liquidatee
		const victimAccountId = await createVictimVaultPosition(
			rpcEndpoint,
			masterAddress,
			accountNft,
			prefix,
			creditManagerAddress,
			[{ denom: 'uosmo', amount: '110000' }],
			client,
			{ denom: 'uosmo', amount: '1000' },
			{ denom: atomDenom, amount: '1000' },
			'l_o_c_k_e_d',
		)

		console.log('created vault position')
		// set price at 0.5

		await setPrice(cwClient, masterAddress, atomDenom, '1.75', config.oracleAddress)

		// set up liquidator
		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)
	} catch (e) {
		console.error(e)
		return false
	}

	console.log('Finished vault test')
	return true
}

const runLockedVaultTest = async (
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
	exec: MarsCreditManagerClient,
): Promise<boolean> => {
	try {
		console.log('Testing locked vault')
        console.log(exec.allowedCoins)
		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)

		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', usdcDenom, atomDenom, gammPool1],
			},
		})

		// // Set up our liquidatee
		const victimAccountId = await createVictimVaultPosition(
			rpcEndpoint,
			masterAddress,
			accountNft,
			prefix,
			creditManagerAddress,
			[{ denom: 'uosmo', amount: '110000' }],
			client,
			{ denom: 'uosmo', amount: '10000' },
			{ denom: atomDenom, amount: '10000' },
			'l_o_c_k_e_d',
		)

		console.log('created vault position')
		// set price at 0.5

		await setPrice(cwClient, masterAddress, atomDenom, '1.75', config.oracleAddress)

		// set up liquidator
		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)
	} catch (e) {
		console.log(e)
		return false
	}

	console.log('Finished vault test')
	return true
}

const runCoinBorrowTest = async (
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
			client,
			masterAddress,
			rpcEndpoint,
			config.creditManagerAddress,
			config.accountNftAddress,
			prefix,
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
		await setPrice(cwClient, masterAddress, atomDenom, '1.4', config.oracleAddress)
		// set up liquidator

		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)
		console.log('Finished simple test')
	} catch(e) {
        console.error(e)
		return false
	}
	return true
}

const lpCoinLiquidate = async (
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
    exec : MarsCreditManagerClient
): Promise<boolean> => {
	try {
		console.log('Starting lpCoin test')
        await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', usdcDenom, atomDenom, gammPool1],
			},
		})
		// Set up our liquidatee
		const { mnemonic } = await DirectSecp256k1HdWallet.generate(24)
	const {
		address: victimAddress,
		exec: vExec,
		nft: vNft,
	} = await createServices(rpcEndpoint, creditManagerAddress, accountNft, mnemonic, prefix)
    const amount = '100000'
    const depositCoin = {
        amount: amount,
        denom: 'uosmo',
    }
    
    const borrowCoin = {
        amount: amount,
        denom: 'uatom',
    }

	await client.sendTokens(masterAddress, victimAddress, [{ amount: (Number(amount)*1.1).toFixed(0), denom: 'uosmo' }], 'auto')

	const victimAccountId = await createCreditAccount(victimAddress, vNft, vExec)
    const liquidityCoins: ActionCoin[] = [
		// NOTE - Order of the coins matters.
		{ denom: borrowCoin.denom, amount: { exact: borrowCoin.amount } },
		{ denom: depositCoin.denom, amount: { exact: depositCoin.amount } },
	]
    const provideLiquidity : Action = {
        provide_liquidity: {
            coins_in: liquidityCoins,
            lp_token_out: gammPool1,
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
			provideLiquidity
		],
		victimAccountId,
		vExec,
		[{ amount: depositCoin.amount, denom: 'uosmo' }], 
	)

		// set price at 0.5
		await setPrice(cwClient, masterAddress, atomDenom, '1.75', config.oracleAddress)
		await setPrice(cwClient, masterAddress, gammPool1, '0.000000025', config.oracleAddress)
		// set up liquidator

        await executor.refreshData()
		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)
        await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
			},
		})
		console.log('Finished simple test')
	} catch(e) {
        console.error(e)
		return false
	}
	return true
}

const liquidateCoinWithMarketDisabled = async (
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	try {
		console.log('Starting disabled market test')
		await updateMarketBorrow(client, masterAddress, redbankAddress, atomDenom, true)

		// Victim2 is that same as the first, except we disable market before liquidation
		// disable market
		const victimAccount = await createVictimCoinPosition(
			client,
			masterAddress,
			rpcEndpoint,
			config.creditManagerAddress,
			config.accountNftAddress,
			prefix,
			[{ denom: 'uosmo', amount: '1100000' }],
			{
				amount: '1000000',
				denom: 'uosmo',
			},
			{
				amount: '500000',
				denom: atomDenom,
			},
		)

		// set price at 0.5
		await setPrice(cwClient, masterAddress, atomDenom, '1.4', config.oracleAddress)

		await updateMarketBorrow(client, masterAddress, redbankAddress, atomDenom, false)

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)
		await updateMarketBorrow(client, masterAddress, redbankAddress, atomDenom, true)
		console.log(await client.getAllBalances(config.liquidatorAddress))
		console.log('Completed market disabled test')
	} catch {
		return false
	}
	return true
}

const runIlliquidRedbankTest = async (
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	try {
		console.log('Starting illiquid market test')
		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)

		// disable market
		const victimAccountId = await createVictimCoinPosition(
			client,
			masterAddress,
			rpcEndpoint,
			config.creditManagerAddress,
			config.accountNftAddress,
			prefix,
			[{ denom: 'uosmo', amount: '1100000' }],
			{
				amount: '1000000',
				denom: 'uosmo',
			},
			{
				amount: '500000',
				denom: atomDenom,
			},
		)

		await executor.refreshData()

		// update price
		const priceMsg = {
			set_price_source: {
				denom: atomDenom,
				price_source: {
					fixed: { price: '1.6' },
				},
			},
		}
		// find market liquidity
		const marketLiquidity =
			executor.markets.find((marketInfo) => marketInfo.denom === atomDenom)?.available_liquidity ||
			0

		// give creditline to master account, and borrow
		const creditLineMsg = {
			update_uncollateralized_loan_limit: {
				user: masterAddress,
				denom: atomDenom,
				new_limit: '1000000000000',
			},
		}

		// const msgs = []

		// borrow all assets to make market utilisation 100%
		const borrowAmount = (marketLiquidity - 100).toFixed(0)
		const borrowMessage = { borrow: { denom: atomDenom, amount: borrowAmount } }
		console.log(JSON.stringify(borrowMessage))
		await client.signAndBroadcast(
			masterAddress,
			[
				makeExecuteContractMessage(
					masterAddress,
					redbankAddress,
					toUtf8(JSON.stringify(creditLineMsg)),
				),
				makeExecuteContractMessage(masterAddress, oracleAddress, toUtf8(JSON.stringify(priceMsg))),
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
			if (market.denom === atomDenom) market.available_liquidity = 0
			return market
		})

		await executor.liquidate(victimAccountId)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)

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
	cwClient: SigningCosmWasmClient,
	client: SigningStargateClient,
	executor: Executor,
	masterAddress: string,
	config: RoverExecutorConfig,
): Promise<boolean> => {
	try {
		console.log('Starting creditLine exceeded test')

		const victimAccount2 = await createVictimCoinPosition(
			client,
			masterAddress,
			rpcEndpoint,
			config.creditManagerAddress,
			config.accountNftAddress,
			prefix,
			[{ denom: 'uosmo', amount: '1100000' }],
			{
				amount: '1000000',
				denom: 'uosmo',
			},
			{
				amount: '500000',
				denom: atomDenom,
			},
		)

		// update price
		const priceMsg = {
			set_price_source: {
				denom: atomDenom,
				price_source: {
					fixed: { price: '1.6' },
				},
			},
		}

		// give creditline to master account, and borrow
		const creditLineMsg = {
			update_uncollateralized_loan_limit: {
				user: creditManagerAddress,
				denom: atomDenom,
				// cannot set new limit to 0 if we have existing debt,
				new_limit: '10000000000',
			},
		}

		await client.signAndBroadcast(
			masterAddress,
			[
				makeExecuteContractMessage(
					masterAddress,
					redbankAddress,
					toUtf8(JSON.stringify(creditLineMsg)),
				),
				makeExecuteContractMessage(masterAddress, oracleAddress, toUtf8(JSON.stringify(priceMsg))),
			],
			'auto',
		)

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount2)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)

		// Reset credit line to be usable for next tests
		await client.signAndBroadcast(
			masterAddress,
			[
				makeExecuteContractMessage(
					masterAddress,
					redbankAddress,
					toUtf8(
						JSON.stringify({
							update_uncollateralized_loan_limit: {
								user: creditManagerAddress,
								denom: atomDenom,
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
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
			},
		})
		// Victim3 is that same as the first, except we remove debt coin from allowed coins before liquidation
		// reenable market
		// remove coin
		const victimAccount3 = await createVictimCoinPosition(
			client,
			masterAddress,
			rpcEndpoint,
			config.creditManagerAddress,
			config.accountNftAddress,
			prefix,
			[{ denom: 'uosmo', amount: '1100000' }],
			{
				amount: '1000000',
				denom: 'uosmo',
			},
			{
				amount: '500000',
				denom: atomDenom,
			},
		)

		// set price at 0.5
		await setPrice(cwClient, masterAddress, atomDenom, '1.4', config.oracleAddress)

		// remove coin from whitelist
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
			},
		})

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount3)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
			},
		})
	} catch (e) {
		console.error(e)
		return false
	}
	return true
}

const coinLargerThanVaultTest = async (
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
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
			},
		})
		// Victim3 is that same as the first, except we remove debt coin from allowed coins before liquidation
		// reenable market
		// remove coin
		const victimAccount3 = await createVictimCoinPosition(
			client,
			masterAddress,
			rpcEndpoint,
			config.creditManagerAddress,
			config.accountNftAddress,
			prefix,
			[{ denom: 'uosmo', amount: '1100000' }],
			{
				amount: '1000000',
				denom: 'uosmo',
			},
			{
				amount: '500000',
				denom: atomDenom,
			},
		)

		// set price at 0.5
		await setPrice(cwClient, masterAddress, atomDenom, '1.4', config.oracleAddress)

		// remove coin from whitelist
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
			},
		})

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount3)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
			},
		})
	} catch {
		return false
	}
	return true
}
const vaultLargerThanCoinTest = async (
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
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
			},
		})
		// Victim3 is that same as the first, except we remove debt coin from allowed coins before liquidation
		// reenable market
		// remove coin
		const victimAccount3 = await createVictimCoinPosition(
			client,
			masterAddress,
			rpcEndpoint,
			config.creditManagerAddress,
			config.accountNftAddress,
			prefix,
			[{ denom: 'uosmo', amount: '1100000' }],
			{
				amount: '1000000',
				denom: 'uosmo',
			},
			{
				amount: '500000',
				denom: atomDenom,
			},
		)

		// set price at 0.5
		await setPrice(cwClient, masterAddress, atomDenom, '1.4', config.oracleAddress)

		// remove coin from whitelist
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
			},
		})

		// refresh market data
		await executor.refreshData()

		await executor.liquidate(victimAccount3)

		await setPrice(cwClient, masterAddress, atomDenom, '1', config.oracleAddress)
		await exec.updateConfig({
			updates: {
				allowed_coins: ['uosmo', usdcDenom, atomDenom],
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
	rpcEndpoint: string,
	masterAddress: string,
	accountNft: string,
	prefix: string,
	creditManagerAddress: string,
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
	} = await createServices(rpcEndpoint, creditManagerAddress, accountNft, mnemonic, prefix)

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
							address: vaultOsmoAtom1,
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
				lp_token_out: gammPool1,
				minimum_receive: '1',
			},
		},
		{
			enter_vault: {
				coin: {
					denom: gammPool1,
					amount: 'account_balance',
				},
				vault: {
					address: vaultOsmoAtom1,
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
	masterClient: SigningStargateClient,
	masterAddress: string,
	rpcEndpoint: string,
	creditManagerAddress: string,
	accountNft: string,
	prefix: string,
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
	} = await createServices(rpcEndpoint, creditManagerAddress, accountNft, mnemonic, prefix)

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
		[{ amount: depositCoin.amount, denom: 'uosmo' }], 
	)

	return victimAccountId
}

const main = async () => {
	await testLiquidations()
}

main().then(() => process.exit())
