// // **********************************************
// // Integration tests for the liquidation logic
// // **********************************************

// import { StdFee, makeCosmoshubPath } from '@cosmjs/amino'
// import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
// import { HdPath } from '@cosmjs/crypto'
// import { DirectSecp256k1HdWallet, EncodeObject } from '@cosmjs/proto-signing'
// import { SigningStargateClient } from '@cosmjs/stargate'
// import { RedisClientType } from '@redis/client'
// import { toUtf8 } from '@cosmjs/encoding'
// import { RedisInterface } from '../../../src/redis.js'
// import {
// 	borrow,
// 	deposit,
// 	produceExecuteContractMessage,
// 	produceSigningCosmWasmClient,
// 	produceSigningStargateClient,
// 	queryHealth,
// 	seedAddresses,
// 	setPrice,
// 	sleep,
// } from '../../../src/helpers.js'
// import { Position } from '../../../src/types/position'
// import 'dotenv/config.js'
// import { RedbankExecutor, RedbankExecutorConfig } from '../../../src/redbank/RedbankExecutor'
// import { localnetConfig, TestConfig } from './config.js'
// import { PoolDataProviderInterface } from '../../../src/query/amm/PoolDataProviderInterface'
// import { ExchangeInterface } from '../../../src/execute/ExchangeInterface'
// import { Osmosis } from '../../../src/execute/Osmosis.js'
// import { OsmosisPoolProvider } from '../../../src/query/amm/OsmosisPoolProvider'
// import { AssetParamsUpdate } from 'marsjs-types/redbank/generated/mars-params/MarsParams.types.js'
// import { Coin } from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types.js'
// import { LiquidationBonus } from '../../../src/types/marsParams.js'
// import * as fs from 'fs';
// import BigNumber from 'bignumber.js'
// import { exec } from 'child_process';

// const EXECUTOR_QUEUE = 'executor_queue'
// const redisInterface = new RedisInterface(EXECUTOR_QUEUE)

// // run test
// const runTest = async (
// 	testConfig: TestConfig, 
// 	numberOfPositions: number, 
// 	positionCollaterals: Coin[], 
// 	positionDebts: Coin[],
// 	initialPrices: Coin[],
// 	unhealthyPrices : Coin[],
// 	updateParamMsgs: AssetParamsUpdate[],
// 	targetHealthFactor : string) => {

// 	const redisClient: RedisClientType = await redisInterface.connect()

// 	// Create n number wallets - but make them random between 1 and a million
// 	const accountNumbers: number[] = []

// 	// add master / deployer account
// 	accountNumbers.push(0)
// 	// use <= so that we can use the first account as a liquidator, and have numberOfPositions
// 	// amount of positions left to liquidate, and + 1 to account for the intial master account
// 	while (accountNumbers.length <= numberOfPositions + 1) {
// 		accountNumbers.push(Number((Math.random() * 1e6).toFixed(0)))
// 	}

// 	const hdPaths: HdPath[] = accountNumbers.map((value) => makeCosmoshubPath(value))
// 	const wallet = await DirectSecp256k1HdWallet.fromMnemonic(testConfig.seed, {
// 		hdPaths: hdPaths,
// 		prefix: 'osmo',
// 	})

// 	const accounts = await wallet.getAccounts()
// 	const cwClient = await produceSigningCosmWasmClient(testConfig.rpcEndpoint, wallet)
// 	const sgClient = await produceSigningStargateClient(testConfig.rpcEndpoint, wallet)

// 	const baseTokenAmount = 2000000000

// 	const deployerAddress = accounts[0].address

// 	// let liquidator be second account
// 	const liquidatorAddress = accounts[1].address

// 	let setupMessages : EncodeObject[] = []

// 	// for every price, create the pool again. This is done because we want to sure
// 	for (const price of unhealthyPrices) {
// 		createPool(
// 			price.denom,
// 			'uusd',
// 			Number(price.amount)
// 		)

// 		await sleep(1000)
// 	}

// 	// make sure address provider has a credit manager set - deployment currently does not do that.
// 	setupMessages.push(
// 		produceExecuteContractMessage(
// 			deployerAddress,
// 			'osmo1wug8sewp6cedgkmrmvhl3lf3tulagm9hnvy8p0rppz9yjw0g4wtqcm3670',
// 			toUtf8(JSON.stringify(
// 				{
// 					set_address: {
// 						address: "osmo1zwugj8tz9nq63m3lxcfpunp0xr5lnlxdr0yyn4gpftx3ham09m4skn73ew",
// 						address_type: "credit_manager"
// 					}
// 				}
// 				)),
// 			[]
// 		)
// 	)
			
// 	setupMessages.push(
// 		produceExecuteContractMessage(
// 			deployerAddress,
// 			testConfig.marsParamsAddress,
// 			toUtf8(JSON.stringify({
// 				update_target_health_factor: targetHealthFactor
// 			})),
// 			[],
// 		)
// 	)
	
// 	updateParamMsgs.forEach((msg) => {
// 		setupMessages.push(produceExecuteContractMessage(
// 			deployerAddress,
// 			testConfig.marsParamsAddress,
// 			toUtf8(JSON.stringify({
// 				update_asset_params: msg
// 			})),
// 			[],
// 		))
// 	})
	
// 	await sgClient.signAndBroadcast(
// 		deployerAddress,
// 		setupMessages,
// 		"auto"
// 	)

// 	// Set the initial balance of the neutral
// 	let initialBalance = {
// 		// get balance of neutral
// 		[testConfig.usdcDenom]: await cwClient.getBalance(liquidatorAddress, testConfig.usdcDenom),
// 		[testConfig.gasDenom]: await cwClient.getBalance(liquidatorAddress, testConfig.gasDenom)
// 	}

// 	// Top up balance
// 	for (const key of Object.keys(initialBalance)) { 
// 		const amount = Number(initialBalance[key].amount)
// 		const difference = amount - baseTokenAmount
// 		if (difference < 0) {

// 			const sendingFee : StdFee = {
// 				amount: [{ amount: '100000', denom: testConfig.gasDenom }],
// 				gas : '200000'
// 			}

// 			console.log(`sending ${Math.abs(difference)} ${key} to ${liquidatorAddress}`)
// 			await sgClient.sendTokens(
// 				deployerAddress,
// 				liquidatorAddress,
// 				[{ amount: Math.abs(difference).toString(), denom: key }],
// 				sendingFee,
// 			)

// 		}
// 	}

	

// 	const config = {
// 		gasDenom: 'uosmo',
// 		chainName: "osmosis",
// 		hiveEndpoint: testConfig.hiveEndpoint,
// 		lcdEndpoint: testConfig.lcdEndpoint,
// 		liquidatableAssets: ['uosmo', 'uatom', 'uusd'],
// 		neutralAssetDenom: 'uusd',
// 		liquidatorMasterAddress: liquidatorAddress,
// 		liquidationFiltererAddress: testConfig.liquidationFiltererAddress,
// 		oracleAddress: testConfig.oracleAddress,
// 		redbankAddress: testConfig.redbankAddress,
// 		safetyMargin: 0.05,
// 		logResults: true,
// 		queueName: EXECUTOR_QUEUE,
// 		redisEndpoint: '',
// 		poolsRefreshWindow: 60000,
// 		liquidationProfitMarginPercent: 0.01,
// 		marsParamsAddress: 'osmo10qt8wg0n7z740ssvf3urmvgtjhxpyp74hxqvqt7z226gykuus7eqxj2v4d',
// 	}

// 	const useableAddresses = await seedAddresses(
// 		cwClient,
// 		deployerAddress,
// 		accounts.slice(2, 2 + numberOfPositions),
// 		positionCollaterals,
// 		{
// 			amount: [{ amount: '100000', denom: testConfig.gasDenom }],
// 			gas : '200000'
// 		}
// 	)

// 	for (const price of initialPrices) {
// 		await setPrice(cwClient, deployerAddress, price.denom, price.amount, testConfig.oracleAddress)
// 	}

// 	for (const debt of positionDebts) {
// 		console.log(`depositing ${debt.amount} ${debt.denom}`)
// 		await deposit(cwClient, deployerAddress, debt.denom, debt.amount, testConfig.redbankAddress)
// 	}

// 	console.log('Creating Positions...')
// 	const length = useableAddresses.length
// 	let index = 0
// 	while (index < length) {
// 		const address = useableAddresses[index]
// 		try {
// 			for (const collateral of positionCollaterals) {
// 				await deposit(cwClient, address, collateral.denom, collateral.amount, testConfig.redbankAddress)
// 			}
			
// 			for (const debt of positionDebts) {
// 				await borrow(cwClient, address, debt.denom, debt.amount, testConfig.redbankAddress)
// 			}

// 			console.log(`- created position for address ${address}`)
// 		} catch (e) {
// 			console.error(`- error occurred creating position for ${address}`)
// 			console.error(e)
// 		}

// 		index += 1
// 	}

// 	await pushPositionsToRedis(useableAddresses, redisClient, 'testing-queue')

// 	for (const price of unhealthyPrices) {
// 		await setPrice(cwClient, deployerAddress, price.denom, price.amount, testConfig.oracleAddress)
// 	}

// 	const poolProvider = new OsmosisPoolProvider(testConfig.lcdEndpoint)
// 	const exchangeInterface = new Osmosis()
// 	for (const address of useableAddresses){
// 		const healthBeforeLiquidation = await queryHealth(cwClient, address, testConfig.redbankAddress)
// 		console.log({
// 			address,
// 			health: JSON.stringify(healthBeforeLiquidation.health_status)
// 		})
// 	}

// 	console.log(`Waiting for liquidations to complete...`)
// 	initialBalance = {
// 		[testConfig.usdcDenom]: await cwClient.getBalance(liquidatorAddress, testConfig.usdcDenom),
// 		[testConfig.gasDenom]: await cwClient.getBalance(liquidatorAddress, testConfig.gasDenom)
// 	}

// 	// execute liquidations
// 	await dispatchLiquidations(sgClient, cwClient, config, poolProvider, exchangeInterface)

// 	for (const address of useableAddresses) {
// 		const health = await queryHealth(cwClient, address, testConfig.redbankAddress)

// 		const ltv = Number(health.health_status.borrowing.liq_threshold_hf)
// 		console.log({ address, ltv })
// 		if ( ltv < 1) {
// 			console.log(`${address} is still unhealthy`)
// 		} else {
// 			console.log(`${address} is healthy`)
// 		}
// 	}

// 	const updatedBalance = {
// 		[testConfig.gasDenom]: await cwClient.getBalance(liquidatorAddress, testConfig.gasDenom),
// 		[testConfig.usdcDenom]: await cwClient.getBalance(liquidatorAddress, testConfig.usdcDenom),
// 	}

// 	console.log({
// 		updatedBalance,
// 		initialBalance,
// 	})
	
// 	const gains = Number(updatedBalance[config.neutralAssetDenom].amount) - Number(initialBalance[config.neutralAssetDenom].amount)

// 	// record results
// 	if (gains < 0) {
// 		console.error('ERROR : Updated balance was smaller than initial balance. Asset')
// 	} else if (gains === 0) {
// 		console.log('No liquidations occurred')
// 	} else {
// 		console.log('Successfully completed liquidations :)')
// 		console.log(`Gained ${gains}`)
// 	}
// }

// const pushPositionsToRedis = async (
// 	addresses: string[],
// 	redisClient: RedisClientType,
// 	queueName: string,
// ) => {
// 	for (const index in addresses) {
// 		const position: Position = {
// 			Identifier: addresses[index],
// 		}

// 		await redisClient.lPush(queueName, JSON.stringify(position))
// 	}
// }

// const dispatchLiquidations = async (
// 	client: SigningStargateClient,
// 	cwClient: CosmWasmClient,
// 	config: RedbankExecutorConfig,
// 	poolProvider: PoolDataProviderInterface,
// 	exchangeInterface: ExchangeInterface,

// ) => {

// 	const executor = new RedbankExecutor(config, client, cwClient, poolProvider, exchangeInterface)

// 	await executor.initiateRedis()

// 	await executor.updatePriceSources()
// 	await executor.updateOraclePrices()
// 	await executor.fetchAssetParams()
// 	await executor.fetchTargetHealthFactor()
// 	await executor.run()
// }

// //////////////////////////
// // // // TESTS // // //
// //////////////////////////

// const main = async () => {
// 	const config = localnetConfig

// 	await test_debtBoundedByMDR(config)
// 	await test_debtBoundedByCollateral(config)
// 	await test_debtBoundedByDebt(config)
// 	await test_debtNotBounded(config)
// 	await test_definedByMinLb(config)
// 	await test_noLiquidationIfUnprofitable(config)

// 	process.exit(0)
// }

// const test_noLiquidationIfUnprofitable = async (config : TestConfig) => {
// 	const collateralOneDenom = 'uatom'
// 	const collateralTwoDenom = 'umars'

// 	const debtOneDenom = 'uosmo'
// 	const debtTwoDenom = 'uion'

// 	const collaterals = [
// 	{
// 		denom: collateralOneDenom,
// 		amount: (42 * 1e6).toString(),
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: (10 * 1e6).toString(),
// 	}
// ]
// 	const debts = [
// 		{
// 			denom: debtOneDenom,
// 			amount: (285 * 1e6).toString(),
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: (120* 1e6).toString(),
// 		}
// 	]
// 	const initialPrices = [
// 	{	
// 		denom: collateralOneDenom,
// 		amount: '13',
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: '0.65',
// 	},
// 	{
// 		denom: debtOneDenom,
// 		amount: '1',
// 	},
// 	{
// 		denom: debtTwoDenom,
// 		amount: '0.4',
// 	}]

// 	const postPrices = [
// 		{	
// 			denom: collateralOneDenom,
// 			amount: '10',
// 		},
// 		{
// 			denom: collateralTwoDenom,
// 			amount: '0.65',
// 		},
// 		{
// 			denom: debtOneDenom,
// 			amount: '1',
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: '0.41',
// 		}]
	
// 	const liquidationBonus : LiquidationBonus = {
// 		max_lb: '0.2',
// 		min_lb: '0',
// 		slope: '2',
// 		starting_lb: '0'
// 	}

// 	const collateralOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				denom: 'uatom',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.78',
// 				protocol_liquidation_fee: '0.02',
// 				max_loan_to_value: '0.779999',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 				deposit_cap: '10000000000000000'
// 			},
// 		},
// 	}

// 	const collateralTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'umars',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.6999',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}
// 	// we add debt messages just to ensure that we have the market

// 	const debtOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uion',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const debtTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uosmo',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const targetHealthFactor = '1.05'
	
// 	await runTest(
// 		config, 
// 		1,
// 		collaterals,
// 		debts,
// 		initialPrices,
// 		postPrices,
// 		[
// 			collateralOneMsg,
// 			collateralTwoMsg,
// 			debtOneMsg,
// 			debtTwoMsg
// 		],
// 		targetHealthFactor
// 	)
// }

// const test_definedByMinLb = async (config : TestConfig) => {
// 	const collateralOneDenom = 'uatom'
// 	const collateralTwoDenom = 'umars'

// 	const debtOneDenom = 'uosmo'
// 	const debtTwoDenom = 'uion'

// 	const collaterals = [
// 	{
// 		denom: collateralOneDenom,
// 		amount: (20 * 1e6).toString(),
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: (100 * 1e6).toString(),
// 	}
// ]
// 	const debts = [
// 		{
// 			denom: debtOneDenom,
// 			amount: (100 * 1e6).toString(),
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: (300* 1e6).toString(),
// 		}
// 	]
// 	const initialPrices = [
// 	{	
// 		denom: collateralOneDenom,
// 		amount: '13',
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: '0.65',
// 	},
// 	{
// 		denom: debtOneDenom,
// 		amount: '1',
// 	},
// 	{
// 		denom: debtTwoDenom,
// 		amount: '0.4',
// 	}]

// 	const postPrices = [
// 		{	
// 			denom: collateralOneDenom,
// 			amount: '10',
// 		},
// 		{
// 			denom: collateralTwoDenom,
// 			amount: '0.65',
// 		},
// 		{
// 			denom: debtOneDenom,
// 			amount: '1.25',
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: '0.45',
// 		}]
	
// 	const liquidationBonus : LiquidationBonus = {
// 		max_lb: '0.2',
// 		min_lb: '0.05',
// 		slope: '1',
// 		starting_lb: '0'
// 	}

// 	const collateralOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				denom: 'uatom',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.78',
// 				protocol_liquidation_fee: '0.02',
// 				max_loan_to_value: '0.779999',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 				deposit_cap: '10000000000000000'
// 			},
// 		},
// 	}

// 	const collateralTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'umars',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.6999',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}
// 	// we add debt messages just to ensure that we have the market

// 	const debtOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uion',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const debtTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uosmo',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const targetHealthFactor = '1.05'
	
// 	await runTest(
// 		config, 
// 		1,
// 		collaterals,
// 		debts,
// 		initialPrices,
// 		postPrices,
// 		[
// 			collateralOneMsg,
// 			collateralTwoMsg,
// 			debtOneMsg,
// 			debtTwoMsg
// 		],
// 		targetHealthFactor
// 	)
// }

// const test_debtNotBounded = async (config : TestConfig) => {
// 	const collateralOneDenom = 'uatom'
// 	const collateralTwoDenom = 'umars'

// 	const debtOneDenom = 'uosmo'
// 	const debtTwoDenom = 'uion'

// 	const collaterals = [
// 	{
// 		denom: collateralOneDenom,
// 		amount: (25 * 1e6).toString(),
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: (100 * 1e6).toString(),
// 	}
// ]
// 	const debts = [
// 		{
// 			denom: debtOneDenom,
// 			amount: (100 * 1e6).toString(),
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: (300* 1e6).toString(),
// 		}
// 	]
// 	const initialPrices = [
// 	{	
// 		denom: collateralOneDenom,
// 		amount: '13',
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: '0.65',
// 	},
// 	{
// 		denom: debtOneDenom,
// 		amount: '1',
// 	},
// 	{
// 		denom: debtTwoDenom,
// 		amount: '0.4',
// 	}]

// 	const postPrices = [
// 		{	
// 			denom: collateralOneDenom,
// 			amount: '10',
// 		},
// 		{
// 			denom: collateralTwoDenom,
// 			amount: '0.65',
// 		},
// 		{
// 			denom: debtOneDenom,
// 			amount: '1.25',
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: '0.45',
// 		}]
	
// 	const liquidationBonus : LiquidationBonus = {
// 		max_lb: '0.2',
// 		min_lb: '0.05',
// 		slope: '2',
// 		starting_lb: '0'
// 	}

// 	const collateralOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				denom: 'uatom',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.78',
// 				protocol_liquidation_fee: '0.02',
// 				max_loan_to_value: '0.779999',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 				deposit_cap: '10000000000000000'
// 			},
// 		},
// 	}

// 	const collateralTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'umars',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.6999',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}
// 	// we add debt messages just to ensure that we have the market

// 	const debtOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uion',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const debtTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uosmo',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const targetHealthFactor = '1.05'
	
// 	await runTest(
// 		config, 
// 		1,
// 		collaterals,
// 		debts,
// 		initialPrices,
// 		postPrices,
// 		[
// 			collateralOneMsg,
// 			collateralTwoMsg,
// 			debtOneMsg,
// 			debtTwoMsg
// 		],
// 		targetHealthFactor
// 	)
// }

// const test_debtBoundedByDebt = async (config : TestConfig) => {
// 	const collateralOneDenom = 'uatom'
// 	const collateralTwoDenom = 'umars'

// 	const debtOneDenom = 'uosmo'
// 	const debtTwoDenom = 'uion'

// 	const collaterals = [
// 	{
// 		denom: collateralOneDenom,
// 		amount: (25 * 1e6).toString(),
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: (100 * 1e6).toString(),
// 	}
// ]
// 	const debts = [
// 		{
// 			denom: debtOneDenom,
// 			amount: (100 * 1e6).toString(),
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: (300* 1e6).toString(),
// 		}
// 	]
// 	const initialPrices = [
// 	{	
// 		denom: collateralOneDenom,
// 		amount: '13',
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: '0.65',
// 	},
// 	{
// 		denom: debtOneDenom,
// 		amount: '1',
// 	},
// 	{
// 		denom: debtTwoDenom,
// 		amount: '0.4',
// 	}]

// 	const postPrices = [
// 		{	
// 			denom: collateralOneDenom,
// 			amount: '10',
// 		},
// 		{
// 			denom: collateralTwoDenom,
// 			amount: '0.65',
// 		},
// 		{
// 			denom: debtOneDenom,
// 			amount: '1',
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: '0.5',
// 		}]
	
// 	const liquidationBonus : LiquidationBonus = {
// 		max_lb: '0.2',
// 		min_lb: '0.02',
// 		slope: '2',
// 		starting_lb: '0.02'
// 	}

// 	const collateralOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				denom: 'uatom',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.78',
// 				protocol_liquidation_fee: '0.02',
// 				max_loan_to_value: '0.779999',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 				deposit_cap: '10000000000000000'
// 			},
// 		},
// 	}

// 	const collateralTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'umars',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.6999',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}
// 	// we add debt messages just to ensure that we have the market

// 	const debtOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uion',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const debtTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uosmo',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const targetHealthFactor = '1.05'
	
// 	await runTest(
// 		config, 
// 		1,
// 		collaterals,
// 		debts,
// 		initialPrices,
// 		postPrices,
// 		[
// 			collateralOneMsg,
// 			collateralTwoMsg,
// 			debtOneMsg,
// 			debtTwoMsg
// 		],
// 		targetHealthFactor
// 	)
// }

// const test_debtBoundedByCollateral = async (config : TestConfig) => {
// 	const collateralOneDenom = 'uatom'
// 	const collateralTwoDenom = 'umars'

// 	const debtOneDenom = 'uosmo'
// 	const debtTwoDenom = 'uion'

// 	const collaterals = [
// 	{
// 		denom: collateralOneDenom,
// 		amount: (10 * 1e6).toString(),
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: (350 * 1e6).toString(),
// 	}
// ]
// 	const debts = [
// 		{
// 			denom: debtOneDenom,
// 			amount: (200 * 1e6).toString(),
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: (100* 1e6).toString(),
// 		}
// 	]
// 	const initialPrices = [
// 	{	
// 		denom: collateralOneDenom,
// 		amount: '13',
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: '0.65',
// 	},
// 	{
// 		denom: debtOneDenom,
// 		amount: '1',
// 	},
// 	{
// 		denom: debtTwoDenom,
// 		amount: '0.4',
// 	}]

// 	const postPrices = [
// 		{	
// 			denom: collateralOneDenom,
// 			amount: '10',
// 		},
// 		{
// 			denom: collateralTwoDenom,
// 			amount: '0.65',
// 		},
// 		{
// 			denom: debtOneDenom,
// 			amount: '1',
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: '0.5',
// 		}]
	
// 	const liquidationBonus : LiquidationBonus = {
// 		max_lb: '0.2',
// 		min_lb: '0.02',
// 		slope: '2',
// 		starting_lb: '0.02'
// 	}

// 	const collateralOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				denom: 'uatom',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.78',
// 				protocol_liquidation_fee: '0.02',
// 				max_loan_to_value: '0.779999',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 				deposit_cap: '10000000000000000'
// 			},
// 		},
// 	}

// 	const collateralTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'umars',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.6999',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}
// 	// we add debt messages just to ensure that we have the market

// 	const debtOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uion',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const debtTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uosmo',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const targetHealthFactor = '1.05'
	
// 	await runTest(
// 		config, 
// 		1,
// 		collaterals,
// 		debts,
// 		initialPrices,
// 		postPrices,
// 		[
// 			collateralOneMsg,
// 			collateralTwoMsg,
// 			debtOneMsg,
// 			debtTwoMsg
// 		],
// 		targetHealthFactor
// 	)
// }

// const test_debtBoundedByMDR = async (config : TestConfig) => {
// 	const collateralOneDenom = 'uatom'
// 	const collateralTwoDenom = 'umars'

// 	const debtOneDenom = 'uosmo'
// 	const debtTwoDenom = 'uion'

// 	const collaterals = [
// 	{
// 		denom: collateralOneDenom,
// 		amount: (42 * 1e6).toString(),
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: (10 * 1e6).toString(),
// 	}
// ]
// 	const debts = [
// 		{
// 			denom: debtOneDenom,
// 			amount: (285 * 1e6).toString(),
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: (120* 1e6).toString(),
// 		}
// 	]
// 	const initialPrices = [
// 	{	
// 		denom: collateralOneDenom,
// 		amount: '13',
// 	},
// 	{
// 		denom: collateralTwoDenom,
// 		amount: '0.65',
// 	},
// 	{
// 		denom: debtOneDenom,
// 		amount: '1',
// 	},
// 	{
// 		denom: debtTwoDenom,
// 		amount: '0.4',
// 	}]

// 	const postPrices = [
// 		{	
// 			denom: collateralOneDenom,
// 			amount: '10',
// 		},
// 		{
// 			denom: collateralTwoDenom,
// 			amount: '0.65',
// 		},
// 		{
// 			denom: debtOneDenom,
// 			amount: '1',
// 		},
// 		{
// 			denom: debtTwoDenom,
// 			amount: '0.5',
// 		}]
	
// 	const liquidationBonus : LiquidationBonus = {
// 		max_lb: '0.2',
// 		min_lb: '0.02',
// 		slope: '2',
// 		starting_lb: '0.02'
// 	}

// 	const collateralOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				denom: 'uatom',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.78',
// 				protocol_liquidation_fee: '0.02',
// 				max_loan_to_value: '0.779999',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 				deposit_cap: '10000000000000000'
// 			},
// 		},
// 	}

// 	const collateralTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'umars',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.6999',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}
// 	// we add debt messages just to ensure that we have the market

// 	const debtOneMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uion',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const debtTwoMsg: AssetParamsUpdate = {
// 		add_or_update : {
// 			params: {
// 				denom: 'uosmo',
// 				credit_manager: {
// 					whitelisted: false,
// 				},
// 				deposit_cap: '10000000000000000',
// 				liquidation_bonus: liquidationBonus,
// 				liquidation_threshold: '0.7',
// 				max_loan_to_value: '0.695',
// 				protocol_liquidation_fee: '0.02',
// 				red_bank: {
// 					borrow_enabled: true,
// 					deposit_enabled: true,
// 				},
// 			}
// 		}
// 	}

// 	const targetHealthFactor = '1.05'
	
// 	await runTest(
// 		config, 
// 		1,
// 		collaterals,
// 		debts,
// 		initialPrices,
// 		postPrices,
// 		[
// 			collateralOneMsg,
// 			collateralTwoMsg,
// 			debtOneMsg,
// 			debtTwoMsg
// 		],
// 		targetHealthFactor
// 	)
// }

// // HELPERS
// const createPool = (baseAssetDenom: string, quoteAssetDenom : string, price: number) => {
// 	const baseAmount = new BigNumber(100000000000)
// 	const quoteAmount = baseAmount.multipliedBy(price).toFixed(0)
// 	const data = {
// 		"weights": `5${baseAssetDenom},5${quoteAssetDenom}`,
// 		"initial-deposit": `${baseAmount}${baseAssetDenom},${quoteAmount}${quoteAssetDenom}`,
// 		"swap-fee": "0.002",
// 		"exit-fee": "0",
// 		"future-governor": ""
// 	   }

// 	// osmo.js does not support creating pools via the API, so we need to do it manually via osmosis daemon
// 	writePool(JSON.stringify(data))
// 	initPools()
// }

// const initPools = () => {
// 	const command = './init_pools.sh'; // Replace with your desired terminal command

// 	exec(command, (error, _, stderr) => {
// 	if (error) {
// 		console.error(`Error: ${error.message}`);
// 		return;
// 	}
// 	if (stderr) {
// 		console.error(`Stderr: ${stderr}`);
// 		return;
// 	}
// 	});
// }

// const writePool = (jsonData: string) => {
// 	try {
// 		fs.writeFileSync('pool.json', jsonData);
// 	  } catch (error) {
// 		console.error('Error writing to pool.json:', error);
// 	  }
// }

// main().catch((e) => {
// 	console.log(e)
// 	process.exit(1)
// })
