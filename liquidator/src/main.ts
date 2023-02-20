import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { produceReadOnlyCosmWasmClient, produceSigningStargateClient } from './helpers.js'
import { getConfig } from './redbank/config/osmosis.js'
import { Executor } from './redbank/executor.js'
import { getSecretManager } from './secretManager.js'
import { Network } from './types/network.js'

export const main = async () => {

  const sm = getSecretManager()

  const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(await sm.getSeedPhrase(), {
    prefix: process.env.PREFIX!,
  })

  const liquidatorMasterAddress = (await liquidator.getAccounts())[0].address

  // produce clients
  const queryClient = await produceReadOnlyCosmWasmClient(process.env.RPC_ENDPOINT!)
  const client = await produceSigningStargateClient(process.env.RPC_ENDPOINT!, liquidator)

  await new Executor(
    // Change network to fit your requirements
    getConfig(liquidatorMasterAddress,Network.TESTNET),
    client,
    queryClient,
  ).start()
}

main().catch((e) => {
  console.log(e)
  process.exit(1)
})
