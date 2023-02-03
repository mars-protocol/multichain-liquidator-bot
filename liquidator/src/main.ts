import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { produceReadOnlyCosmWasmClient, produceSigningStargateClient } from './helpers.js'
import { Executor } from './redbank/executor.js'
import { getSecretManager } from './secretManager.js'

export const main = async () => {

  const sm = getSecretManager()

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
      logResults:true
    },
    client,
    queryClient,
  ).start()
}

main().catch((e) => {
  console.log(e)
  process.exit(1)
})
