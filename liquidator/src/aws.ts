import { SecretsManager } from "@aws-sdk/client-secrets-manager";


const sm = new SecretsManager({region: process.env.AWS_REGION})
interface SeedSecretResponse {
    Seed: string
}
export const getSeedPhrase = async() : Promise<string>=> {

    const environment = process.env.ENVIRONMENT

    if (environment !== 'production') {
        return process.env.SEED!
    }

    const output = await sm.getSecretValue({SecretId: process.env.SECRET_ID})

    if (!output) {
        throw new Error("Failed to load seed from aws secrets manager")
    }

    const seedResponse : SeedSecretResponse = JSON.parse(output.SecretString!)
    
    return seedResponse.Seed!
}
