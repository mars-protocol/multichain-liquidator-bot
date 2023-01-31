import { Executor } from "./redbank/executor.js"

export const main = async() => {
  
  // If you wish to use a secret manager, construct it here
  const sm = getDefaultSecretManager()

  await new Executor({
    gasDenom: 'uosmo',
    hiveEndpoint: process.env.HIVE_ENDPOINT!,
    lcdEndpoint: process.env.LCD_ENDPOINT!,
    rpcEndpoint: process.env.RPC_ENDPOINT!,
    mnemonic: await sm.getSeedPhrase(),
    liquidatableAssets: JSON.parse(process.env.LIQUIDATABLE_ASSETS!),
    neutralAssetDenom: process.env.NEUTRAL_ASSET_DENOM!,
    prefix: process.env.PREFIX!,
    contracts: {
      liquidationFilterer: process.env.LIQUIDATION_FILTERER_CONTRACT!,
      oracle: process.env.ORACLE_ADDRESS!,
      redbank: process.env.REDBANK_ADDRESS!
    }
  }).start()
}


main().catch((e) => {
  console.log(e)
  process.exit(1)
})

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
