"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecretManager = void 0;
const getSecretManager = () => {
    return {
        getSeedPhrase: async () => {
            const seed = process.env.SEED;
            if (!seed)
                throw Error('Failed to find SEED environment variable. Add your seed phrase to the SEED environment variable or implement a secret manager instance');
            return seed;
        },
    };
};
exports.getSecretManager = getSecretManager;
//# sourceMappingURL=secretManager.js.map