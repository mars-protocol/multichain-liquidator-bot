// **********************************************
// Integration tests for the liquidation logic
// **********************************************

import { makeCosmoshubPath } from '@cosmjs/amino'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { HdPath } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import { RedisClientType } from '@redis/client'
import { RedisInterface } from '../../../src/redis.js'
import {
	borrow,
	deposit,
	produceSigningCosmWasmClient,
	produceSigningStargateClient,
	queryHealth,
	seedAddresses,
	setPrice,
} from '../../../src/helpers.js'
import { Position } from '../../../src/types/position'
import 'dotenv/config.js'
import { RedbankExecutor, RedbankExecutorConfig } from '../../../src/redbank/RedbankExecutor'
import { localnetConfig, TestConfig } from './config.js'

const EXECUTOR_QUEUE = 'executor_queue'
const redisInterface = new RedisInterface()

// run test
const runTest = async (testConfig: TestConfig, numberOfPositions: number) => {
	console.log(`Running test with ${numberOfPositions} positions`)

	const redisClient: RedisClientType = await redisInterface.connect()

	// Create n number wallets - but make them random between 1 and a million
	const accountNumbers: number[] = []

	// add master / deployer account
	accountNumbers.push(0)
	// use <= so that we can use the first account as a liquidator, and have numberOfPositions
	// amount of positions left to liquidate, and + 1 to account for the intial master account
	while (accountNumbers.length <= numberOfPositions + 1) {
		accountNumbers.push(Number((Math.random() * 1e6).toFixed(0)))
	}

	const hdPaths: HdPath[] = accountNumbers.map((value) => makeCosmoshubPath(value))
	const wallet = await DirectSecp256k1HdWallet.fromMnemonic(testConfig.seed, {
		hdPaths: hdPaths,
		prefix: 'osmo',
	})

	const accounts = await wallet.getAccounts()
	const cwClient = await produceSigningCosmWasmClient(testConfig.rpcEndpoint, wallet)
	const sgClient = await produceSigningStargateClient(testConfig.rpcEndpoint, wallet)

	const deployerAddress = accounts[0].address
	// let liquidator be second account
	const liquidatorAccount = accounts[1].address

	// send some tokens to redbank to ensure
	console.log('seeding redbank')

	await sgClient.sendTokens(
		deployerAddress,
		liquidatorAccount,
		[{ amount: '1000000', denom: testConfig.usdcDenom }],
		'auto',
	)
	await sgClient.sendTokens(
		deployerAddress,
		liquidatorAccount,
		[{ amount: '1000000', denom: testConfig.gasDenom }],
		'auto',
	)
	await sgClient.sendTokens(
		deployerAddress,
		testConfig.redbankAddress,
		[{ amount: '10000000', denom: testConfig.atomDenom }],
		'auto',
	)

	const config = {
		gasDenom: 'uosmo',
		hiveEndpoint: testConfig.hiveEndpoint,
		lcdEndpoint: testConfig.lcdEndpoint,
		liquidatableAssets: ['osmo', 'atom', 'usdc'],
		neutralAssetDenom: 'usdc',
		liquidatorMasterAddress: liquidatorAccount,
		liquidationFiltererAddress: testConfig.liquidationFiltererAddress,
		oracleAddress: testConfig.oracleAddress,
		redbankAddress: testConfig.redbankAddress,
		safetyMargin: 0.05,
		logResults: true,
		queueName: 'redbank-queue',
		redisEndpoint: '',
		poolsRefreshWindow: 60000,
	}

	const osmoToSend = { amount: '11000000', denom: testConfig.gasDenom }
	const atomToSend = { amount: '10000000', denom: testConfig.atomDenom }

	// seed all our addresses with value - in this case just one
	const useableAddresses = await seedAddresses(
		cwClient,
		deployerAddress,
		accounts.slice(2, 2 + numberOfPositions),
		[atomToSend, osmoToSend],
	)

	// set prices, both at 1
	console.log(`setting prices`)
	await setPrice(cwClient, deployerAddress, testConfig.gasDenom, '1', testConfig.oracleAddress)
	await setPrice(cwClient, deployerAddress, testConfig.atomDenom, '1', testConfig.oracleAddress)

	console.log(`seeding redbank with intial deposit`)

	// create relatively large position with deployer, to ensure all other positions can borrow liquidate without issue
	// await deposit(cwClient, deployerAddress, testConfig.atomDenom, '1000000', testConfig.redbankAddress)
	await sgClient.sendTokens(
		deployerAddress,
		testConfig.redbankAddress,
		[{ amount: '10000000000', denom: testConfig.atomDenom }],
		'auto',
	)
	await sgClient.sendTokens(
		deployerAddress,
		testConfig.redbankAddress,
		[{ amount: '10000000000', denom: testConfig.gasDenom }],
		'auto',
	)

	console.log('Setting up positions')
	const length = useableAddresses.length
	let index = 0
	while (index < length) {
		const address = useableAddresses[index]
		try {
			await deposit(cwClient, address, testConfig.gasDenom, '10000', testConfig.redbankAddress)
			await borrow(cwClient, address, testConfig.atomDenom, '3000', testConfig.redbankAddress)
			console.log(`created position for address ${address}`)
		} catch (e) {
			console.log(`error occurred creating positions for ${address}`)
			console.log(e)
		}

		index += 1
	}

	await pushPositionsToRedis(useableAddresses, redisClient, EXECUTOR_QUEUE)

	// manipulate price
	await setPrice(cwClient, deployerAddress, testConfig.atomDenom, '2.2', testConfig.oracleAddress)

	const initialBalance = {
		uosmo: await cwClient.getBalance(liquidatorAccount, testConfig.gasDenom),
		atom: await cwClient.getBalance(liquidatorAccount, testConfig.atomDenom),
		usdc: await cwClient.getBalance(liquidatorAccount, testConfig.usdcDenom),
	}

	console.log(`================= executing liquidations =================`)
	// execute liquidations
	await dispatchLiquidations(sgClient, cwClient, config)

	for (const index in useableAddresses) {
		const health = await queryHealth(cwClient, useableAddresses[index], testConfig.redbankAddress)
		if (Number(health.health_status.borrowing.liq_threshold_hf) < 1) {
			console.log(`${useableAddresses[index]} is still unhealthy`)
		} else {
			console.log(`${useableAddresses[index]} is healthy`)
		}
	}

	const updatedBalance = {
		uosmo: await cwClient.getBalance(liquidatorAccount, testConfig.gasDenom),
		atom: await cwClient.getBalance(liquidatorAccount, testConfig.atomDenom),
		usdc: await cwClient.getBalance(liquidatorAccount, testConfig.usdcDenom),
	}

	console.log({
		updatedBalance,
		initialBalance,
	})
	const gains = Number(updatedBalance.usdc.amount) - Number(initialBalance.usdc.amount)

	if (gains < 0) {
		console.error('ERROR : Updated balance was smaller than initial balance. Asset')
	} else {
		console.log('Successfully completed liquidations :)')
		console.log(`Gained ${gains}`)
	}
}

const pushPositionsToRedis = async (
	addresses: string[],
	redisClient: RedisClientType,
	queueName: string,
) => {
	for (const index in addresses) {
		console.log(`pushing position to redis: ${addresses[index]}`)
		const position: Position = {
			Address: addresses[index],
		}

		await redisClient.lPush(queueName, JSON.stringify(position))
	}
}

const dispatchLiquidations = async (
	client: SigningStargateClient,
	cwClient: CosmWasmClient,
	config: RedbankExecutorConfig,
) => {
	const executor = new RedbankExecutor(config, client, cwClient)

	await executor.initiateRedis()
	await executor.run()
}
const main = async () => {
	const config = localnetConfig
	await runTest(config, 1)
	await runTest(config, 5)
}
main().catch((e) => {
	console.log(e)
	process.exit(1)
})
