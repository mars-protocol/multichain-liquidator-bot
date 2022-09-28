import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate";
import { HdPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { makeCosmoshubPath } from "@cosmjs/amino";
import { GasPrice } from "@cosmjs/stargate";
import 'dotenv/config.js'

export const getPositionCount = async() => {

    const accountNumbers: number[] = [];

    while (accountNumbers.length < 10) {
        accountNumbers.push(accountNumbers.length)
    }

    const hdPaths : HdPath[] = accountNumbers.map((value) => makeCosmoshubPath(value));
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(process.env.DEPLOYER_SEED!, { hdPaths: hdPaths, prefix: 'osmo' });
    const accounts = await wallet.getAccounts()

    const client = await createClient(wallet)

    const coins = [
        {"amount": "10050000", "denom": 'uion'},
        // {"amount": "10000000", "denom": 'uion'}
    ]

    console.log(accounts[0].address)
    console.log(accounts[1].address)

    await client.sendTokens(accounts[0].address,accounts[1].address, coins, "auto")

    console.log(await client.getBalance(accounts[1].address, 'uion'))

    // // 
    // const { data } = await CLIENT.wasm.queryAllContractState(address, {
    //     "pagination.limit": "10000",
    //     "pagination.reverse": true,
    //   });
}

const createClient = async(wallet : DirectSecp256k1HdWallet) : Promise<SigningCosmWasmClient> => {
    const clientOption: SigningCosmWasmClientOptions = {
        gasPrice: GasPrice.fromString("0.1uosmo")
      }

    return await SigningCosmWasmClient.connectWithSigner(process.env.RPC_URL!, wallet, clientOption);
}

getPositionCount().catch(e => console.log(e))