// for types - see original
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
export const getSecretManager = () => {
	const client = new SecretsManagerClient({
		region: 'ap-southeast-1',
	})

	return {
		getSeedPhrase: async (): Promise<string> => {
			const mnemonic = process.env.WALLET_MNEMONIC
			if (mnemonic) {
				return mnemonic
			} else {
				const secretName = process.env.WALLET_MNEMONIC_SECRET_NAME
				console.log('Fetching mnemonic')
				const response = await client.send(
					new GetSecretValueCommand({
						SecretId: secretName,
						VersionStage: 'AWSCURRENT', // VersionStage defaults to AWSCURRENT if unspecified
					}),
				)

				const secret = JSON.parse(response.SecretString!)
				console.log('Successfully retrieved mnemonic')
				return Object.values(secret)[0] as string
			}
		},
	}
}