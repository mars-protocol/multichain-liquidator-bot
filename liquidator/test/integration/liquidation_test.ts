
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

const addresses = {
  "redBankCodeId": 8,
  "liquidationFilterCodeId": 9,
  "addressProviderCodeId": 10,
  "maTokenCodeId": 11,
  "incentivesCodeId": 12,
  "oracleCodeId": 13,
  "protocolRewardsCollectorCodeId": 14,
  "addressProviderContractAddress": "osmo1999u8suptza3rtxwk7lspve02m406xe7l622erg3np3aq05gawxsj2lrr5",
  "liquidateFilterContractAddress": "osmo1g6kht9c5s4jwn4akfjt3zmsfh4nvguewaegjeavpz3f0q9uylrqscsp5xx",
  "redBankContractAddress": "osmo1qmk0v725sdg5ecu6xfh5pt0fv0nfzrstarue2maum3snzk2zrt5qmj77re",
  "incentivesContractAddress": "osmo1657pee2jhf4jk8pq6yq64e758ngvum45gl866knmjkd83w6jgn3s5fzut3",
  "oracleContractAddress": "osmo1xhcxq4fvxth2hn3msmkpftkfpw73um7s4et3lh4r8cfmumk3qsms2tpuum",
  "protocolRewardsCollectorContractAddress": "osmo1wr6vc3g4caz9aclgjacxewr0pjlre9wl2uhq73rp8mawwmqaczsqqzjacj",
  "addressProviderUpdated": true,
  "uosmoRedBankMarketInitialised": true,
  "uatomRedBankMarketInitialised": true,
  "uosmoOraclePriceSet": true,
  "uatomOraclePriceSet": true
}
const osmoDenom = 'uosmo'
const atomDenom = 'uion'

const deployerSeed = "notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius"

// preferentially run tests on local ososis
const localOsmosisRPC = "http://localhost:26657"


  // run test
const runTest = async() => {

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
    gasPrice: GasPrice.fromString("0.09uosmo")
  }

  const client = await SigningCosmWasmClient.connectWithSigner(localOsmosisRPC, wallet, clientOption);
    
  const deployerAddress = accounts[0].address
  
  // console.log(await client.getBalance(deployerAddress,osmoDenom))
  // console.log(await client.getBalance(deployerAddress,atomDenom))


  // // seed addresses with value
  // const addressesWithMoney =   await seedAddresses(client, accounts) // getFirstAddresses(accounts)
  // // const addressesWithMoney = getFirstAddresses(accounts)
  // // set prices, both at 1
  // console.log(`setting prices`)
  // await setPrice(client,deployerAddress,osmoDenom, "1")
  // await setPrice(client,deployerAddress,atomDenom, "1")

  // console.log(`seeding redbank with intial deposit`)
  // // create relatively large position with deployer, to ensure all other positions can borrow liquidate without issue
  // await deposit(client, deployerAddress, osmoDenom, "100_000_000")

  // for each address we seeded, we need to create a debt position

  const addressesWithMoney = getFirstAddresses(accounts)
  console.log('Setting up positions')
  const length = addressesWithMoney.length
  let index = 0
  while (index < length) {
    try {
      const address = addressesWithMoney[index]
      await deposit(client, address, atomDenom, "10000000")
      await borrow(client, address, osmoDenom, "3000000")
      console.log(`created position for address ${address}`)

    } catch {}
    
    index += 1
  }
  
  // TODO - Verify position has a reasonable health factor?
  console.log(await queryHealth(client, addressesWithMoney[8]))

  // manipulate price
  await setPrice(client, deployerAddress, osmoDenom, "3")

  // TODO - Verify position has a reasonable health factor?
  console.log(await queryHealth(client, addressesWithMoney[8]))

  
}



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

runTest().catch(e => console.log(e))