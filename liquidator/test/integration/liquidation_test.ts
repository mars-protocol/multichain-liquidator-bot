
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
import { Position } from "../../src/types/position";

const addresses = {
  "redBankCodeId": 2,
  "liquidationFilterCodeId": 3,
  "addressProviderCodeId": 4,
  "maTokenCodeId": 5,
  "incentivesCodeId": 6,
  "oracleCodeId": 7,
  "protocolRewardsCollectorCodeId": 8,
  "addressProviderContractAddress": "osmo18cszlvm6pze0x9sz32qnjq4vtd45xehqs8dq7cwy8yhq35wfnn3qtcvtsz",
  "liquidateFilterContractAddress": "osmo1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh7nad0vhyhtuhw3s0p34vn",
  "redBankContractAddress": "osmo1xr3rq8yvd7qplsw5yx90ftsr2zdhg4e9z60h5duusgxpv72hud3sqcfmyp",
  "incentivesContractAddress": "osmo1466nf3zuxpya8q9emxukd7vftaf6h4psr0a07srl5zw74zh84yjqkk0zfx",
  "oracleContractAddress": "osmo13ehuhysn5mqjeaheeuew2gjs785f6k7jm8vfsqg3jhtpkwppcmzqg496z0",
  "protocolRewardsCollectorContractAddress": "osmo1qum2tr7hh4y7ruzew68c64myjec0dq2s2njf6waja5t0w879lutq0rjkz5",
  "addressProviderUpdated": true,
  "uosmoRedBankMarketInitialised": true,
  "uatomRedBankMarketInitialised": true,
  "uosmoOraclePriceSet": true,
  "uatomOraclePriceSet": true
}
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
    gasPrice: GasPrice.fromString("0.0uosmo")
  }

  const client = await SigningCosmWasmClient.connectWithSigner(localOsmosisRPC, wallet, clientOption);
  const deployerAddress = accounts[0].address  

  const liquidationHelper = new LiquidationHelper(client,deployerAddress, addresses.liquidateFilterContractAddress)
    
  // seed addresses with value
  const useableAddresses =   await seedAddresses(client, accounts)

  // set prices, both at 1
  console.log(`setting prices`)
  await setPrice(client,deployerAddress,osmoDenom, "1")
  await setPrice(client,deployerAddress,atomDenom, "1")


  console.log(`seeding redbank with intial deposit`)
  // // create relatively large position with deployer, to ensure all other positions can borrow liquidate without issue
  await deposit(client, deployerAddress, atomDenom, "100_000_000")

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
  // const addressesWithMoney = getFirstAddresses(accounts)

  await pushPositionsToRedis(useableAddresses, redisClient)
  
  for(const index in useableAddresses) {
    console.log(await queryHealth(client,useableAddresses[index]))
  }

  // manipulate price
  await setPrice(client, deployerAddress, atomDenom, "3")

  // execute liquidations
  await dispatchLiquidations(liquidationHelper)

  // TODO - Verify position has a reasonable health factor?

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

  while (index <= 4) {
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
  const osmoToSend : Coin = coin(11000000, osmoDenom)
  const atomToSend : Coin = coin(10000000, atomDenom)

  const seededAddresses : string[] = []
  let index = 1

  while (index <= 10) {
    const addressToSeed = accounts[index].address
    
    console.log(`sending to address: ${addressToSeed}`)

    // For some reason sending both in the array here breaks it ???
    await client.sendTokens(sender, addressToSeed,[osmoToSend], 'auto')
    await client.sendTokens(sender, addressToSeed,[atomToSend], 'auto')

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