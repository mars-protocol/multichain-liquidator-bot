// **********************************************
// Integration tests for the liquidation logic
// **********************************************
//
// This will require dependencies:
// - Mars protocol artifacts
// - LocalOsmosis
//

import { makeCosmoshubPath } from '@cosmjs/amino'
import {
	CosmWasmClient,
	SigningCosmWasmClient,
	SigningCosmWasmClientOptions,
} from '@cosmjs/cosmwasm-stargate'
import { HdPath } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { GasPrice, SigningStargateClient } from '@cosmjs/stargate'
import { RedisClientType } from 'redis'
import { RedisInterface } from '../../src/redis.js'
import {
	borrow,
	deposit,
	ProtocolAddresses,
	queryHealth,
	readAddresses,
	seedAddresses,
	setPrice,
} from '../../src/helpers.js'
import { Position } from '../../src/types/position'
import path from 'path'
import 'dotenv/config.js'
import { RedbankExecutor, RedbankExecutorConfig } from '../../src/redbank/RedbankExecutor'

const deployDetails = path.join(process.env.OUTPOST_ARTIFACTS_PATH!, `${process.env.CHAIN_ID}.json`)

const addresses: ProtocolAddresses = readAddresses(deployDetails)
const osmoDenom = 'uosmo'
const atomDenom = 'uion'
const redisQueueName = 'testQueue'
const deployerSeed = 'you seed goes here'

// preferentially run tests on local ososis
const localOsmosisRPC = 'http://localhost:26657'

const redisInterface = new RedisInterface()

// run test
const runTest = async () => {
	// @ts-ignore
	const redisClient: RedisClientType = await redisInterface.connect()

	// Create n number wallets
	const accountNumbers: number[] = []
	while (accountNumbers.length < 5) {
		accountNumbers.push(accountNumbers.length)
	}

	const hdPaths: HdPath[] = accountNumbers.map((value) => makeCosmoshubPath(value))

	// Do init
	const wallet = await DirectSecp256k1HdWallet.fromMnemonic(deployerSeed, {
		hdPaths: hdPaths,
		prefix: 'osmo',
	})
	const accounts = await wallet.getAccounts()

	const clientOption: SigningCosmWasmClientOptions = {
		gasPrice: GasPrice.fromString('0.1uosmo'),
	}

	const cwClient = await SigningCosmWasmClient.connectWithSigner(
		localOsmosisRPC,
		wallet,
		clientOption,
	)

	const sgClient = await SigningStargateClient.connectWithSigner(
		localOsmosisRPC,
		wallet,
		clientOption,
	)
	const deployerAddress = accounts[0].address

	const config = {
		gasDenom: 'uosmo',
		hiveEndpoint: 'http://localhost:8085/graphql',
		lcdEndpoint: 'http://127.0.0.1:1317/graphql',
		liquidatableAssets: ['osmo', 'atom', 'usdc'],
		neutralAssetDenom: 'usdc',
		liquidatorMasterAddress: deployerAddress,
		liquidationFiltererAddress: addresses.filterer,
		oracleAddress: addresses.oracle,
		redbankAddress: addresses.redBank,
		safetyMargin: 0.05,
		logResults: true,
		redisEndpoint: '',
	}

	const osmoToSend = { amount: '11000000', denom: osmoDenom }
	const atomToSend = { amount: '10000000', denom: atomDenom }

	// seed addresses with value
	const useableAddresses = await seedAddresses(cwClient, deployerAddress, accounts, [
		atomToSend,
		osmoToSend,
	])

	// set prices, both at 1
	console.log(`setting prices`)
	await setPrice(cwClient, deployerAddress, osmoDenom, '1', addresses.oracle)
	await setPrice(cwClient, deployerAddress, atomDenom, '1', addresses.oracle)

	console.log(`seeding redbank with intial deposit`)

	// create relatively large position with deployer, to ensure all other positions can borrow liquidate without issue
	await deposit(cwClient, deployerAddress, atomDenom, '100_000_000', addresses.oracle)
	// await deposit(client, deployerAddress, osmoDenom, "100_000_000", addresses)

	console.log('Setting up positions')
	const length = useableAddresses.length
	let index = 0
	while (index < length) {
		try {
			const address = useableAddresses[index]
			await deposit(cwClient, address, osmoDenom, '10000000', addresses.oracle)
			await borrow(cwClient, address, atomDenom, '3000000', addresses)
			console.log(`created position for address ${address}`)
		} catch {}

		index += 1
	}

	// use this when debugging tests to prevent messing up existing positions
	// const useableAddresses = [getFirstAddresses(accounts)[3], getFirstAddresses(accounts)[1]]

	await pushPositionsToRedis(useableAddresses, redisClient)

	// manipulate price
	await setPrice(cwClient, deployerAddress, atomDenom, '3', addresses.oracle)

	const initialBalance = {
		uosmo: await cwClient.getBalance(deployerAddress, osmoDenom),
		atom: await cwClient.getBalance(deployerAddress, atomDenom),
	}

	console.log(`================= executing liquidations =================`)
	// execute liquidations
	await dispatchLiquidations(sgClient, cwClient, config)

	for (const index in useableAddresses) {
		const health = await queryHealth(cwClient, useableAddresses[index], addresses)
		if (Number(health.health_status.borrowing.liq_threshold_hf) < 1) {
			console.log(`${useableAddresses[index]} is still unhealthy`)
		} else {
			console.log(`${useableAddresses[index]} is healthy`)
		}
	}

	const updatedBalance = {
		uosmo: await cwClient.getBalance(deployerAddress, osmoDenom),
		atom: await cwClient.getBalance(deployerAddress, atomDenom),
	}

	const gains = Number(updatedBalance.atom.amount) - Number(initialBalance.atom.amount)

	if (gains < 0) {
		console.error('ERROR : Updated balance was smaller than initial balance. Asset')
	} else {
		console.log('Successfully completed liquidations :)')
		console.log(`Gained ${gains}`)
	}

	process.exit(0)
}

const pushPositionsToRedis = async (addresses: string[], redisClient: RedisClientType) => {
	for (const index in addresses) {
		console.log(`pushing position to redis: ${addresses[index]}`)
		const position: Position = {
			Address: addresses[index],
		}

		await redisClient.lPush(redisQueueName, JSON.stringify(position))
	}
}

const dispatchLiquidations = async (
	client: SigningStargateClient,
	cwClient: CosmWasmClient,
	config: RedbankExecutorConfig,
) => {
	const executor = new RedbankExecutor(config, client, cwClient)

	await executor.initiate()
	await executor.run()
}

runTest().catch((e) => {
	console.log(e)
	process.exit(1)
})
