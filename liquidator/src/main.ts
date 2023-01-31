import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { produceReadOnlyCosmWasmClient, produceSigningStargateClient } from './helpers.js'
import { Executor } from './redbank/executor.js'

export const main = async () => {
  // If you wish to use a secret manager, construct it here
  const sm = getDefaultSecretManager()

  const liquidator = await DirectSecp256k1HdWallet.fromMnemonic(await sm.getSeedPhrase(), {
    prefix: process.env.PREFIX!,
  })

  const liquidatorMasterAddress = (await liquidator.getAccounts())[0].address

  // produce clients
  const queryClient = await produceReadOnlyCosmWasmClient(process.env.RPC_ENDPOINT!, liquidator)
  const client = await produceSigningStargateClient(process.env.RPC_ENDPOINT!, liquidator)

  await new Executor(
    {
      gasDenom: 'uosmo',
      hiveEndpoint: process.env.HIVE_ENDPOINT!,
      lcdEndpoint: process.env.LCD_ENDPOINT!,
      liquidatableAssets: JSON.parse(process.env.LIQUIDATABLE_ASSETS!) as string[],
      neutralAssetDenom: process.env.NEUTRAL_ASSET_DENOM!,
      liquidatorMasterAddress: liquidatorMasterAddress,
      liquidationFiltererAddress: process.env.LIQUIDATION_FILTERER_CONTRACT!,
      oracleAddress: process.env.ORACLE_ADDRESS!,
      redbankAddress: process.env.REDBANK_ADDRESS!,
    },
    client,
    queryClient,
  ).start()
}

const getDefaultSecretManager = (): SecretManager => {
  return {
    getSeedPhrase: async () => {
      const seed = process.env.SEED
      if (!seed)
        throw Error(
          'Failed to find SEED environment variable. Add your seed phrase to the SEED environment variable or implement a secret manager instance',
        )

      return seed
    },
  }
}

main().catch((e) => {
  console.log(e)
  process.exit(1)
})
