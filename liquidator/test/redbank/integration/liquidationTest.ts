// **********************************************
// Integration tests for the liquidation logic
// **********************************************

import { StdFee, makeCosmoshubPath } from '@cosmjs/amino'
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
import { PoolDataProviderInterface } from '../../../src/query/amm/PoolDataProviderInterface'
import { ExchangeInterface } from '../../../src/execute/ExchangeInterface'
import { Osmosis } from '../../../src/execute/Osmosis.js'
import { OsmosisPoolProvider } from '../../../src/query/amm/OsmosisPoolProvider'

const EXECUTOR_QUEUE = 'executor_queue'
const redisInterface = new RedisInterface(EXECUTOR_QUEUE)

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

	const baseTokenAmount = 20000000

	const deployerAddress = accounts[0].address

	// let liquidator be second account
	const liquidatorAddress = accounts[1].address


	// await cwClient.execute(deployerAddress, "osmo1wug8sewp6cedgkmrmvhl3lf3tulagm9hnvy8p0rppz9yjw0g4wtqcm3670", {
	// 	set_address: {
	// 		address: "osmo1zwugj8tz9nq63m3lxcfpunp0xr5lnlxdr0yyn4gpftx3ham09m4skn73ew",
	// 		address_type: "credit_manager"
	// 	}
	// },
	// "auto")

	let initialBalance = {
		uosmo: await cwClient.getBalance(liquidatorAddress, testConfig.gasDenom),
		// uatom: await cwClient.getBalance(liquidatorAddress, testConfig.atomDenom),
		// uusdc: await cwClient.getBalance(liquidatorAccount, testConfig.usdcDenom),
	}

	// Top up balance
	for (const key of Object.keys(initialBalance)) { 
		const amount = Number(initialBalance[key].amount)
		const difference = amount - baseTokenAmount
		if (difference < 0) {

			const sendingFee : StdFee = {
				amount: [{ amount: '100000', denom: testConfig.gasDenom }],
				gas : '200000'
			}

			console.log(`sending ${Math.abs(difference)} ${key} to ${liquidatorAddress}`)
			await sgClient.sendTokens(
				deployerAddress,
				liquidatorAddress,
				[{ amount: Math.abs(difference).toString(), denom: key }],
				sendingFee,
			)

		}
	}

	initialBalance = {
		uosmo: await cwClient.getBalance(liquidatorAddress, testConfig.gasDenom),
		// uatom: await cwClient.getBalance(liquidatorAddress, testConfig.atomDenom),
		// uusdc: await cwClient.getBalance(liquidatorAccount, testConfig.usdcDenom),
	}

	const config = {
		gasDenom: 'uosmo',
		hiveEndpoint: testConfig.hiveEndpoint,
		lcdEndpoint: testConfig.lcdEndpoint,
		liquidatableAssets: ['uosmo', 'uatom', 'uusdc'],
		neutralAssetDenom: 'uosmo',
		liquidatorMasterAddress: liquidatorAddress,
		liquidationFiltererAddress: testConfig.liquidationFiltererAddress,
		oracleAddress: testConfig.oracleAddress,
		redbankAddress: testConfig.redbankAddress,
		safetyMargin: 0.05,
		logResults: true,
		queueName: EXECUTOR_QUEUE,
		redisEndpoint: '',
		poolsRefreshWindow: 60000,
		liquidationProfitMarginPercent: 0.01,

		marsParamsAddress: 'osmo10qt8wg0n7z740ssvf3urmvgtjhxpyp74hxqvqt7z226gykuus7eqxj2v4d',
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
	await setPrice(cwClient, deployerAddress, testConfig.gasDenom, '1', testConfig.oracleAddress)
	await setPrice(cwClient, deployerAddress, testConfig.atomDenom, '2', testConfig.oracleAddress)

	console.log(`seeding redbank with intial deposit`)

	// const redbankBalance = await
	// create relatively large position with deployer, to ensure all other positions can borrow liquidate without issue
	await deposit(cwClient, deployerAddress, testConfig.gasDenom, '20000000', testConfig.redbankAddress)
	await deposit(cwClient, deployerAddress, testConfig.atomDenom, '1000000', testConfig.redbankAddress)

	// await sgClient.sendTokens(
	// 	deployerAddress,
	// 	testConfig.redbankAddress,
	// 	[{ amount: '10000000000', denom: testConfig.atomDenom }],
	// 	'auto',
	// )

	// await sgClient.sendTokens(
	// 	deployerAddress,
	// 	testConfig.redbankAddress,
	// 	[{ amount: '10000000000', denom: testConfig.gasDenom }],
	// 	'auto',
	// )

	console.log('Creating Positions...')
	const length = useableAddresses.length
	let index = 0
	while (index < length) {
		const address = useableAddresses[index]
		try {
			await deposit(cwClient, address, testConfig.atomDenom, '10000000', testConfig.redbankAddress)
			await borrow(cwClient, address, testConfig.gasDenom, '8000000', testConfig.redbankAddress)

			console.log(`- created position for address ${address}`)
		} catch (e) {
			console.error(`- error occurred creating position for ${address}`)
			console.error(e)
		}

		index += 1
	}

	await pushPositionsToRedis(useableAddresses, redisClient, 'testing-queue')

	// manipulate price
	await setPrice(cwClient, deployerAddress, testConfig.atomDenom, '1', testConfig.oracleAddress)

	const poolProvider = new OsmosisPoolProvider(testConfig.lcdEndpoint)
	const exchangeInterface = new Osmosis()
	console.log(`Waiting for liquidations to complete...`)
	// execute liquidations
	await dispatchLiquidations(sgClient, cwClient, config, poolProvider, exchangeInterface)

	for (const index in useableAddresses) {
		const health = await queryHealth(cwClient, useableAddresses[index], testConfig.redbankAddress)
		const ltv = Number(health.health_status.borrowing.liq_threshold_hf)
		console.log({ ltv })
		if ( ltv < 1) {
			console.log(`${useableAddresses[index]} is still unhealthy`)
		} else {
			console.log(`${useableAddresses[index]} is healthy`)
		}
	}

	const updatedBalance = {
		uosmo: await cwClient.getBalance(liquidatorAddress, testConfig.gasDenom),
		atom: await cwClient.getBalance(liquidatorAddress, testConfig.atomDenom),
		usdc: await cwClient.getBalance(liquidatorAddress, testConfig.usdcDenom),
	}

	console.log({
		updatedBalance,
		initialBalance,
	})
	const gains = Number(updatedBalance[config.neutralAssetDenom].amount) - Number(initialBalance[config.neutralAssetDenom].amount)

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
		const position: Position = {
			Identifier: addresses[index],
		}

		await redisClient.lPush(queueName, JSON.stringify(position))
	}
}

const dispatchLiquidations = async (
	client: SigningStargateClient,
	cwClient: CosmWasmClient,
	config: RedbankExecutorConfig,
	poolProvider: PoolDataProviderInterface,
	exchangeInterface: ExchangeInterface,

) => {
	const executor = new RedbankExecutor(config, client, cwClient, poolProvider, exchangeInterface)

	// await executor.initiateRedis()

	await executor.initiateRedis()

	// todo
	// await this.initiateAstroportPoolProvider()
	await executor.updatePriceSources()
	await executor.updateOraclePrices()
	await executor.fetchAssetParams()
	await executor.fetchTargetHealthFactor()
	await executor.run()
}
const main = async () => {
	const config = localnetConfig
	await runTest(config, 1)
	// await runTest(config, 5)
}
main().catch((e) => {
	console.log(e)
	process.exit(1)
})
