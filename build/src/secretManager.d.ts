export interface SecretManager {
    getSeedPhrase(): Promise<string>;
}
export declare const getSecretManager: () => SecretManager;
