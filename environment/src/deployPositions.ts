import { HdPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

import { RedisClientType } from "redis";
import { Coin, makeCosmoshubPath } from "@cosmjs/amino";
import { RedisInterface } from "../../src/redis.js"
import { deposit, loadSeeds, produceBorrowMessage, produceDepositMessage as produceDepositMessage, ProtocolAddresses, readAddresses, Seed, seedAddresses, setPrice } from "../../src/helpers.js"
import { createClient, recoverWallet, requiredEnvironmentVariables } from "./helpers.js";
import 'dotenv/config.js'
import path from "path";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";

requiredEnvironmentVariables([
    "DEPLOYER_SEED",
    "ACCOUNTS_PER_SEED",
    "RPC_URL",
    "QUEUE_NAME",
    "ATOM_DENOM",
    "OSMO_DENOM",
    "MAX_THREADS",
])

const OWNER_SEED = process.env.DEPLOYER_SEED!

// Setup clients
const ACCOUNTS_PER_SEED = Number(process.env.ACCOUNTS_PER_SEED || '100')
const RPC_URL = process.env.RPC_URL!

const QUEUE_NAME = process.env.QUEUE_NAME
const redisInterface = new RedisInterface(QUEUE_NAME)

// Assets

const OSMO_DENOM = process.env.OSMO_DENOM!
const USDC_DENOM = process.env.USDC_DENOM!

// throttle with this
const MAX_THREADS = Number(process.env.MAX_THREADS!)

const MAX_SEEDS = Number(process.env.MAX_SEEDS || '1000')
const deployDetails = path.join(process.env.OUTPOST_ARTIFACTS_PATH!, `${process.env.CHAIN_ID}.json`)

// @ts-ignore
let redisClient : RedisClientType
let deployerClient  : SigningCosmWasmClient

export const main = async() => {

    // @ts-ignore
    redisClient = await redisInterface.connect()

    // gather required data
    const seeds = loadSeeds() 
    const protocolAddresses = readAddresses(deployDetails)

    console.log(protocolAddresses)
    
    const ownerWallet = await recoverWallet(OWNER_SEED)
    deployerClient = await createClient(ownerWallet)
    const deployerAddress = (await ownerWallet.getAccounts())[0].address

    // set prices, seed redbank, do any other setup for the test in here.
    await preFlightChecks(deployerClient, protocolAddresses, deployerAddress)
    
    await run(seeds, protocolAddresses, deployerAddress)
}

// Process a batch of seeds of ACCOUNTS_PER_SEED size.
const run = async(seeds : Seed[], protocolAddresses : ProtocolAddresses, deployerAddress: string) => {
    
    let batchToProcess : Promise<void>[] = []

    const osmoToSend : Coin = {"amount": "100000_500_000", "denom": OSMO_DENOM}
    // const atomToSend : Coin = {"amount": "1000_500_000", "denom": USDC_DENOM}

    let sendTokenMsgs = []

    console.log(`seeding initial parent addresses`)

    // TODO rework this section so that we only need one loop

    // seed the `parents` (the first account under a seed)
    for (const seedIndex in seeds) {
        const seed = seeds[seedIndex]
        if (Number(seedIndex) > MAX_SEEDS) break
        
        const msg = {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
                fromAddress: deployerAddress,
                toAddress: seed.address,
                amount: [ osmoToSend],
            },
        }
      
        sendTokenMsgs.push(msg)

        if (sendTokenMsgs.length >= MAX_SEEDS) {
            await deployerClient.signAndBroadcast(
                deployerAddress,
                sendTokenMsgs,
                "auto",
                ) 
            sendTokenMsgs = []
        }
    }

    let ltv = 0.55
    for (const seedIndex in seeds) {        
        const index = Number(seedIndex)
        ltv -= 0.025

        if (ltv > 0.04) {
            console.log(`creating ${ACCOUNTS_PER_SEED} positions with ltv of ${ltv}`)

            batchToProcess.push(createPositions(ACCOUNTS_PER_SEED, seeds[seedIndex], protocolAddresses, ltv))
            if (index > 0 && index % MAX_THREADS === 0) {
                await Promise.all(batchToProcess)
                batchToProcess = []
                console.log(`Created ${index * ACCOUNTS_PER_SEED} total positions`)
            }
        }
    }
}



const preFlightChecks = async(client: SigningCosmWasmClient, addresses: ProtocolAddresses, deployerAddress : string) => {

    //uncomment me if you need to set prices
   // set prices, both at 1
//    console.log(`setting prices @ $1`)
   //
//     //@ts-ignore
//    await setPrice(client,deployerAddress,OSMO_DENOM, "1", addresses)
//     //@ts-ignore
//    await setPrice(client,deployerAddress,USDC_DENOM, "1", addresses)
//    //@ts-ignore
//    await setPrice(client,deployerAddress,USDC_DENOM, "1", addresses)   

   console.log(`seeding redbank with intial deposit`)

   // update asset to have greater deposits


   // create relatively large position with deployer, to ensure all other positions can borrow liquidate without issue
    //@ts-ignore
   await deposit(client, deployerAddress, USDC_DENOM, "6500000_000_000", addresses)
    //@ts-ignore
   console.log({deposit: await deposit(client, deployerAddress, OSMO_DENOM, "2000_000_000", addresses)})

   console.log("DEPOSITS DONE")
}

// Creates n number of accounts under a seed, and creates a position for every account.
// TODO add capability to add positions with better configuration such as initial ltvs
const createPositions = async(
    maxPositions: number, 
    seed: Seed, 
    addresses : ProtocolAddresses,
    targetLtv : number) => {

    // build a wallet with n number accounts
    const accountNumbers: number[] = [];

    while (accountNumbers.length < maxPositions) {
        accountNumbers.push(accountNumbers.length)
    }

    const hdPaths : HdPath[] = accountNumbers.map((value) => makeCosmoshubPath(value))
    //@ts-ignore
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(seed.mnemonic, { hdPaths: hdPaths, prefix: 'osmo' })
    const accounts = await wallet.getAccounts()

    const client = await createClient(wallet)

    // seed addresses with value
    const osmoToSend : Coin = {"amount" : "1010050000", "denom": OSMO_DENOM}
    // const atomToSend : Coin = {"amount" : "1000000", "denom": ATOM_DENOM}

    const depositAmount = 1000000000
    const osmoToDeposit : Coin = {"amount": depositAmount.toFixed(0), "denom": OSMO_DENOM}

    //@ts-ignore
    const useableAddresses = await seedAddresses(client, accounts[0].address, accounts, [osmoToSend])
   
    const length = useableAddresses.length

    let index = 0

    while (index < length) {
        try {
        const address = useableAddresses[index]
        console.log(`DEPOSITING : ${depositAmount} osmo`)
        const depositMsg = produceDepositMessage(
            address,
            OSMO_DENOM,
            addresses.redBank,
            [osmoToDeposit]
        )

        const borrowAmount = (depositAmount * targetLtv).toFixed(0)

        console.log(`BORROWING ${borrowAmount} USDC`)

        // make borrow message based off of ltv
        const borrowMsg = produceBorrowMessage(
            address,
            USDC_DENOM,
            borrowAmount,
            addresses.redBank
        )

        console.log({address})
        // console.log(await client.queryContractSmart(addresses.redBank, {user_position: {user:address}}))
        // Dispatch deposit and borrow as one asset
        const result = await client.signAndBroadcast(
            address,
            [
                depositMsg,
                borrowMsg
            ],
            "auto",
          ) 
          console.log(result)
          console.log(await client.queryContractSmart(addresses.redBank, {user_position: {user:address}}))

     } catch(e) {

        console.log(e)
        console.log(`failed to create position for user ${seed.address}`)
     }

     index += 1
   }

   // dispatch all msgs 
}

// run
main().catch(e => console.log(e))