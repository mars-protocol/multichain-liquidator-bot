export interface SecretManager {
	getSeedPhrase(): Promise<string>
}

export const getSecretManager = (): SecretManager => {
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
