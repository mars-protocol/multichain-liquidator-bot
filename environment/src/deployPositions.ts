import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate";
import { HdPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import { RedisClientType } from "redis";
import { Coin, makeCosmoshubPath } from "@cosmjs/amino";
import { RedisInterface } from "../../liquidator/src/redis.js"
import { borrow, deposit, loadSeeds, makeBorrowMessage, makeDepositMessage, ProtocolAddresses, readAddresses, Seed, seedAddresses, setPrice } from "../../liquidator/src/helpers.js"
import { requiredEnvironmentVariables } from "./helpers.js";
import 'dotenv/config.js'
import path from "path";

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
const ATOM_DENOM = process.env.ATOM_DENOM!
const OSMO_DENOM = process.env.OSMO_DENOM!

// throttle with this
const MAX_THREADS = Number(process.env.MAX_THREADS!)

const MAX_SEEDS = Number(process.env.MAX_SEEDS || '1000')
const deployDetails = path.join(process.env.OUTPOST_ARTIFACTS_PATH!, `${process.env.CHAIN_ID}.json`)

// TODO set me via .env?
const borrowAmount = "3000000"

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

    const osmoToSend : Coin = {"amount": "1000_000_000", "denom": OSMO_DENOM}
    const atomToSend : Coin = {"amount": "1000_000_000", "denom": ATOM_DENOM}

    let sendTokenMsgs = []

    console.log(`seeding initial parent addresses`)


    // TODO rework this section so that we only need one loop

    // seed 1000 `parents` (the first account under a seed)
    for (const seedIndex in seeds) {
        const seed = seeds[seedIndex]
        if (Number(seedIndex) > MAX_SEEDS) break
        
        const msg = {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
                fromAddress: deployerAddress,
                toAddress: seed.address,
                amount: [atomToSend, osmoToSend],
            },
        }
      
        sendTokenMsgs.push(msg)

        if (sendTokenMsgs.length >= 100) {
            await deployerClient.signAndBroadcast(
                deployerAddress,
                sendTokenMsgs,
                "auto",
                ) 
            sendTokenMsgs = []
        }
    }

    // optimise this by making it one loop?
    for (const seedIndex in seeds) {        
        const index = Number(seedIndex)

        batchToProcess.push(createPositions(ACCOUNTS_PER_SEED, seeds[seedIndex], protocolAddresses))
        if (index > 0 && index % MAX_THREADS === 0) {
            await Promise.all(batchToProcess)
            batchToProcess = []
            console.log(`Created ${index * ACCOUNTS_PER_SEED} total positions`)
        }
    }
}

const recoverWallet = async(seed: string) : Promise<DirectSecp256k1HdWallet> => {
    return await DirectSecp256k1HdWallet.fromMnemonic(seed, { prefix: 'osmo'} );
}

const createClient = async(wallet : DirectSecp256k1HdWallet) : Promise<SigningCosmWasmClient> => {
    const clientOption: SigningCosmWasmClientOptions = {
        gasPrice: GasPrice.fromString("0.1uosmo")
      }

    return await SigningCosmWasmClient.connectWithSigner(RPC_URL, wallet, clientOption);
}

const preFlightChecks = async(client: SigningCosmWasmClient, addresses: ProtocolAddresses, deployerAddress : string) => {

    // TODO REMOVE ME ONCE CONTRACT UPDATED - have this here to be able to liquidate successfully
   await client.sendTokens(deployerAddress, addresses.filterer, [{"amount": "1000000000", "denom":ATOM_DENOM}], "auto")
 
   // set prices, both at 1
   console.log(`setting prices @ $1`)
   await setPrice(client,deployerAddress,OSMO_DENOM, "1", addresses)
   await setPrice(client,deployerAddress,ATOM_DENOM, "1", addresses)
 
   console.log(`seeding redbank with intial deposit`)
   // create relatively large position with deployer, to ensure all other positions can borrow liquidate without issue
   await deposit(client, deployerAddress, ATOM_DENOM, "100000_000_000", addresses)
   await deposit(client, deployerAddress, OSMO_DENOM, "100000_000_000", addresses)
}

// Creates n number of accounts under a seed, and creates a position for every account.
// TODO add capability to add positions with better configuration such as initial ltvs
const createPositions = async(
    maxPositions: number, 
    seed: Seed, 
    addresses : ProtocolAddresses) => {

    // build a wallet with n number accounts
    const accountNumbers: number[] = [];

    while (accountNumbers.length < maxPositions) {
        accountNumbers.push(accountNumbers.length)
    }

    const hdPaths : HdPath[] = accountNumbers.map((value) => makeCosmoshubPath(value));
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(seed.mnemonic, { hdPaths: hdPaths, prefix: 'osmo' });
    const accounts = await wallet.getAccounts()

    const client = await createClient(wallet)

    // seed addresses with value
    const osmoToSend : Coin = {"amount": "10050000", "denom": OSMO_DENOM}
    const atomToSend : Coin = {"amount": "10000000", "denom": ATOM_DENOM}

    const osmoToDeposit : Coin = {"amount": "10000000", "denom": OSMO_DENOM}

    const useableAddresses = await seedAddresses(client, accounts[0].address, accounts, [atomToSend, osmoToSend])
   
   const length = useableAddresses.length

   let index = 0

   while (index < length) {
     try {
        const address = useableAddresses[index]

        const depositMsg = makeDepositMessage(
            address,
            OSMO_DENOM,
            addresses.redBank,
            [osmoToDeposit]
        )

        const borrowMsg = makeBorrowMessage(
            address,
            ATOM_DENOM,
            borrowAmount,
            addresses.redBank
        )

        // Dispatch deposit and borrow as one asset
        await client.signAndBroadcast(
            address,
            [
                depositMsg,
                borrowMsg
            ],
            "auto",
          ) 

     } catch(e) {

        console.log(e)
        console.log(`failed to create position for user ${seed.address}`)
     }

     index += 1
   }

   // dispatch all msgs 
}

const sendPositionMessage = async(client: SigningCosmWasmClient, address: string, addresses: ProtocolAddresses) => {

    
    
    await deposit(client, address, OSMO_DENOM, "10000000", addresses)
    await borrow(client, address, ATOM_DENOM, "3000000", addresses)
    console.log(`created position for address ${address}`)
}

// run
main().catch(e => console.log(e))