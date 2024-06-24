"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCreditAccount = exports.generateNewAddress = exports.createCreditAccount = exports.PositionCollectionType = void 0;
const helpers_js_1 = require("../../../src/helpers.js");
const proto_signing_1 = require("@cosmjs/proto-signing");
const lodash_1 = require("lodash");
var PositionCollectionType;
(function (PositionCollectionType) {
    PositionCollectionType[PositionCollectionType["CASCADE"] = 0] = "CASCADE";
    PositionCollectionType[PositionCollectionType["FIXED"] = 1] = "FIXED";
})(PositionCollectionType = exports.PositionCollectionType || (exports.PositionCollectionType = {}));
const createCreditAccount = async (userAddress, nft, exec) => {
    const before = await nft.tokens({ owner: userAddress });
    await exec.createCreditAccount();
    const after = await nft.tokens({ owner: userAddress });
    const diff = (0, lodash_1.difference)(after.tokens, before.tokens);
    const accountId = diff[0];
    if (accountId === undefined || accountId === null) {
        throw new Error('Failed to create account Id');
    }
    return accountId.toString();
};
exports.createCreditAccount = createCreditAccount;
const generateNewAddress = async (prefix, rpcEndpoint) => {
    const { mnemonic } = await proto_signing_1.DirectSecp256k1HdWallet.generate(24);
    const wallet = await (0, helpers_js_1.getWallet)(mnemonic, prefix);
    const client = await (0, helpers_js_1.produceSigningStargateClient)(rpcEndpoint, wallet);
    const address = await (0, helpers_js_1.getAddress)(wallet);
    return { client, address };
};
exports.generateNewAddress = generateNewAddress;
const updateCreditAccount = async (actions, accountId, exec, funds) => {
    return await exec.updateCreditAccount({ actions, accountId }, 'auto', undefined, funds);
};
exports.updateCreditAccount = updateCreditAccount;
//# sourceMappingURL=roverTestHelpers.js.map