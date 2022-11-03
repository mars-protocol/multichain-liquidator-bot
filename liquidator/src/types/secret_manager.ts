interface SecretManager {
    getSeedPhrase() : Promise<string>
}