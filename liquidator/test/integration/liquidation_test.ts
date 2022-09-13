
// **********************************************
// Integration tests for the liquidation logic
// **********************************************
// 
// This will require dependencies:
// - Mars protocol artifacts
// - LocalOsmosis 
// 

import { AccountData, coin, Coin, makeCosmoshubPath } from "@cosmjs/amino";
import { ExecuteResult, SigningCosmWasmClient, SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate";
import { HdPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import { RedisClientType } from "redis";
import { run } from "../../src/index.js";
import { LiquidationHelper } from "../../src/liquidation_helpers.js";
import { RedisInterface } from "../../src/redis.js";
import { readAddresses } from "../../src/test_helpers.js";
import { Position } from "../../src/types/position";

const addresses = readAddresses()
const osmoDenom = 'uosmo'
const atomDenom = 'uion'
const redisQueueName = 'testQueue'
const deployerSeed = "notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius"

// preferentially run tests on local ososis
const localOsmosisRPC = "http://localhost:26657"

const redisInterface = new RedisInterface(redisQueueName)


  // run test
const runTest = async() => {

  // @ts-ignore
  const redisClient: RedisClientType = await redisInterface.connect()

  // Create 100 wallets
  const accountNumbers: number[] = [];
  while (accountNumbers.length < 100) {

    accountNumbers.push(accountNumbers.length)
  }

  const hdPaths : HdPath[] = accountNumbers.map((value) => makeCosmoshubPath(value));

  // Do init
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(deployerSeed, { hdPaths: hdPaths, prefix: 'osmo' });
  const accounts = await wallet.getAccounts()
  const clientOption: SigningCosmWasmClientOptions = {
    gasPrice: GasPrice.fromString("0.1uosmo")
  }

  const client = await SigningCosmWasmClient.connectWithSigner(localOsmosisRPC, wallet, clientOption);
  const deployerAddress = accounts[0].address  

  const liquidationHelper = new LiquidationHelper(client,deployerAddress, addresses.liquidateFilterContractAddress)
    
  // seed addresses with value
  const useableAddresses =   await seedAddresses(client, accounts)

  // TODO REMOVE ME ONCE CONTRACT UPDATED - have this here to be able to liquidate successfully
  await client.sendTokens(deployerAddress, addresses.liquidateFilterContractAddress, [{"amount": "1000000000", "denom":atomDenom}], "auto")

  // set prices, both at 1
  console.log(`setting prices`)
  await setPrice(client,deployerAddress,osmoDenom, "1")
  await setPrice(client,deployerAddress,atomDenom, "1")


  console.log(`seeding redbank with intial deposit`)
  // // create relatively large position with deployer, to ensure all other positions can borrow liquidate without issue
  await deposit(client, deployerAddress, atomDenom, "100_000_000")
  await deposit(client, deployerAddress, osmoDenom, "100_000_000")


  console.log('Setting up positions')
  const length = useableAddresses.length
  let index = 0
  while (index < length) {
    try {
      const address = useableAddresses[index]
      await deposit(client, address, osmoDenom, "10000000")
      await borrow(client, address, atomDenom, "3000000")
      console.log(`created position for address ${address}`)

    } catch {}
    
    index += 1
  }
  
  // use this when debugging tests to prevent messing up existing positions
  // const useableAddresses = [getFirstAddresses(accounts)[3], getFirstAddresses(accounts)[1]]
  await pushPositionsToRedis(useableAddresses, redisClient)
  
  
  for(const index in useableAddresses) {
    console.log(await queryHealth(client,useableAddresses[index]))
  }

  // manipulate price
  await setPrice(client, deployerAddress, atomDenom, "3")

  for(const index in useableAddresses) {
    console.log(await queryHealth(client,useableAddresses[index]))
  }

  console.log(`================= executing liquidations =================`)
  // execute liquidations
  await dispatchLiquidations(liquidationHelper)

  for(const index in useableAddresses) {
    console.log(await queryHealth(client,useableAddresses[index]))
  }


  console.log("Successfully completed liquidations :)")
  process.exit(0)
}

const pushPositionsToRedis = async(addresses: string[], redisClient : RedisClientType) => {
  for (const index in addresses) {

    console.log(`pushing position to redis: ${addresses[index]}`)
    const position : Position = {
      address:addresses[index],
      collaterals: [
        {
          amount:10000000,
          denom:osmoDenom
        }
      ],
      debts: [
        {
          amount:3000000,
          denom:atomDenom
        }
      ]
    }
    
    await redisClient.lPush(redisQueueName, JSON.stringify(position))
  }
}

const dispatchLiquidations = async(liquidationHelper : LiquidationHelper) => {
    await run(liquidationHelper,redisInterface)
}

// used for debugging tests
const getFirstAddresses = (accounts : readonly AccountData[]) => {

  const seededAddresses : string[] = []
  let index = 1

  while (index <= 10) {
    seededAddresses.push(accounts[index].address)
    index += 1
  }

  return seededAddresses
}

const setPrice = async(client: SigningCosmWasmClient, deployerAddress: string, assetDenom : string, price: string) => {
  const msg = {
    "set_price_source": {
        "denom": assetDenom,
        "price_source": {
            "fixed": { "price":  price}
        }
    }
  }

  await client.execute(deployerAddress,addresses.oracleContractAddress,msg,'auto')
}



// send OSMO and ATOM to next 10 addresses under our seed
const seedAddresses = async(client : SigningCosmWasmClient, accounts : readonly AccountData[]) : Promise<string[]> => {
  
  const sender = accounts[0].address
  const osmoToSend = {"amount": "11000000", "denom": osmoDenom}
  const atomToSend = {"amount": "10000000", "denom": atomDenom}

  const seededAddresses : string[] = []
  let index = 1

  while (index <= 10) {
    const addressToSeed = accounts[index].address
    
    console.log(`sending to address: ${addressToSeed}`)
    await client.sendTokens(sender, addressToSeed,[atomToSend, osmoToSend], 'auto')

    index += 1
    seededAddresses.push(addressToSeed)
  }

  return seededAddresses
}

const withdraw = async(client: SigningCosmWasmClient, sender: string, assetDenom : string, amount : string) => {
  const msg = {
    "withdraw": {
      "denom": assetDenom,
      "amount": amount
    }
  }

  return await client.execute(sender, addresses.redBankContractAddress, msg, "auto")
}

const borrow = async(client: SigningCosmWasmClient, sender: string, assetDenom : string, amount : string) => {
  const msg = {
      "borrow": {
        "denom": assetDenom,
        "amount": amount
    }
  }

  return await client.execute(sender, addresses.redBankContractAddress, msg, "auto")
}

const deposit = async(client: SigningCosmWasmClient, sender: string, assetDenom : string, amount : string) => {
  const msg = { "deposit": { "denom": assetDenom } }
  const coins = [{
        "denom":assetDenom,
        "amount": amount 
    }]

  return await client.execute(sender, addresses.redBankContractAddress, msg, "auto", undefined, coins)
}

const repay = async(client: SigningCosmWasmClient, sender: string, assetDenom : string, amount : string) => {
  const msg = { "repay": { "denom": assetDenom } }
  const coins = [{
        "denom":assetDenom,
        "amount": amount 
    }]

  return await client.execute(sender, addresses.redBankContractAddress, msg, "auto", undefined, coins)
}

const queryHealth = async(client : SigningCosmWasmClient, address: string) => {
  const msg = { "user_position": { "user_address": address } }
  return await client.queryContractSmart(addresses.redBankContractAddress, msg)
}


runTest().catch(e => {
  console.log(e)
  process.exit(1)
})