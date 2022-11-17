// **********************************************
// Integration tests for the liquidation logic
// **********************************************
//
// This will require dependencies:
// - Mars protocol artifacts
// - LocalOsmosis
//

import { makeCosmoshubPath } from '@cosmjs/amino'
import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from '@cosmjs/cosmwasm-stargate'
import { HdPath } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { GasPrice } from '@cosmjs/stargate'
import { RedisClientType } from 'redis'
import { LiquidationHelper } from '../../src/liquidation_helpers.js'
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
import { Executor } from '../../src/executor.js'

const deployDetails = path.join(process.env.OUTPOST_ARTIFACTS_PATH!, `${process.env.CHAIN_ID}.json`)

const addresses: ProtocolAddresses = readAddresses(deployDetails)
const osmoDenom = 'uosmo'
const atomDenom = 'uion'
const redisQueueName = 'testQueue'
const deployerSeed =
  'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius'

// preferentially run tests on local ososis
const localOsmosisRPC = 'http://localhost:26659'

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

  const client = await SigningCosmWasmClient.connectWithSigner(
    localOsmosisRPC,
    wallet,
    clientOption,
  )
  const deployerAddress = accounts[0].address

  const liquidationHelper = new LiquidationHelper(deployerAddress, addresses.filterer)

  const osmoToSend = { amount: '11000000', denom: osmoDenom }
  const atomToSend = { amount: '10000000', denom: atomDenom }

  // seed addresses with value
  const useableAddresses = await seedAddresses(client, deployerAddress, accounts, [
    atomToSend,
    osmoToSend,
  ])

  // set prices, both at 1
  console.log(`setting prices`)
  await setPrice(client, deployerAddress, osmoDenom, '1', addresses)
  await setPrice(client, deployerAddress, atomDenom, '1', addresses)

  console.log(`seeding redbank with intial deposit`)

  // create relatively large position with deployer, to ensure all other positions can borrow liquidate without issue
  await deposit(client, deployerAddress, atomDenom, '100_000_000', addresses)
  // await deposit(client, deployerAddress, osmoDenom, "100_000_000", addresses)

  console.log('Setting up positions')
  const length = useableAddresses.length
  let index = 0
  while (index < length) {
    try {
      const address = useableAddresses[index]
      await deposit(client, address, osmoDenom, '10000000', addresses)
      await borrow(client, address, atomDenom, '3000000', addresses)
      console.log(`created position for address ${address}`)
    } catch {}

    index += 1
  }

  // use this when debugging tests to prevent messing up existing positions
  // const useableAddresses = [getFirstAddresses(accounts)[3], getFirstAddresses(accounts)[1]]

  await pushPositionsToRedis(useableAddresses, redisClient)

  // manipulate price
  await setPrice(client, deployerAddress, atomDenom, '3', addresses)

  const initialBalance = {
    uosmo: await client.getBalance(deployerAddress, osmoDenom),
    atom: await client.getBalance(deployerAddress, atomDenom),
  }
  console.log(`================= executing liquidations =================`)
  // execute liquidations
  await dispatchLiquidations(liquidationHelper)

  for (const index in useableAddresses) {
    const health = await queryHealth(client, useableAddresses[index], addresses)
    if (Number(health.health_status.borrowing.liq_threshold_hf) < 1) {
      console.log(`${useableAddresses[index]} is still unhealthy`)
    } else {
      console.log(`${useableAddresses[index]} is healthy`)
    }
  }

  const updatedBalance = {
    uosmo: await client.getBalance(deployerAddress, osmoDenom),
    atom: await client.getBalance(deployerAddress, atomDenom),
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
      Address: addresses[index]
    }

    await redisClient.lPush(redisQueueName, JSON.stringify(position))
  }
}

const dispatchLiquidations = async (liquidationHelper : LiquidationHelper) => {
  const executor = new Executor()

  const {redis} = await executor.initiate()
  await executor.run(liquidationHelper, redis)
}

// // used for debugging tests
// const getFirstAddresses = (accounts: readonly AccountData[]) => {
//   const seededAddresses: string[] = []
//   let index = 1

//   while (index <= 10) {
//     seededAddresses.push(accounts[index].address)
//     index += 1
//   }

//   return seededAddresses
// }

runTest().catch((e) => {
  console.log(e)
  process.exit(1)
})
