"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSeeds = exports.readArtifact = exports.queryHealth = exports.repay = exports.deposit = exports.produceSwapMessage = exports.produceRepayMessage = exports.produceWithdrawMessage = exports.produceBorrowMessage = exports.produceDepositMessage = exports.produceSendMessage = exports.produceExecuteContractMessage = exports.borrow = exports.withdraw = exports.seedAddresses = exports.setPrice = exports.findUnderlying = exports.produceSigningCosmWasmClient = exports.produceReadOnlyCosmWasmClient = exports.produceSigningStargateClient = exports.getAddress = exports.getWallet = exports.readAddresses = exports.camelCaseKeys = exports.sleep = void 0;
const cosmwasm_stargate_1 = require("@cosmjs/cosmwasm-stargate");
const proto_signing_1 = require("@cosmjs/proto-signing");
const fs_1 = require("fs");
const encoding_1 = require("@cosmjs/encoding");
const osmojs_1 = require("osmojs");
const stargate_1 = require("@cosmjs/stargate");
const lodash_1 = require("lodash");
const { swapExactAmountIn } = osmojs_1.osmosis.gamm.v1beta1.MessageComposer.withTypeUrl;
osmojs_1.osmosis.gamm.v1beta1.MsgSwapExactAmountIn;
async function sleep(timeout) {
    await new Promise((resolve) => setTimeout(resolve, timeout));
}
exports.sleep = sleep;
const camelCaseKeys = (object) => {
    const newObject = {};
    Object.keys(object).forEach((key) => (newObject[(0, lodash_1.camelCase)(key)] = object[key]));
    return newObject;
};
exports.camelCaseKeys = camelCaseKeys;
function readAddresses(deployConfigPath) {
    try {
        const data = (0, fs_1.readFileSync)(deployConfigPath, 'utf8');
        const deployData = JSON.parse(data);
        return (0, exports.camelCaseKeys)(deployData.addresses);
    }
    catch (e) {
        console.error(`Failed to load artifacts path - could not find ${deployConfigPath}`);
        process.exit(1);
    }
}
exports.readAddresses = readAddresses;
const getWallet = async (mnemonic, prefix, hdPaths) => {
    const options = hdPaths ? { hdPaths, prefix } : { prefix };
    return await proto_signing_1.DirectSecp256k1HdWallet.fromMnemonic(mnemonic, options);
};
exports.getWallet = getWallet;
const getAddress = async (wallet) => {
    const accounts = await wallet.getAccounts();
    return accounts[0].address;
};
exports.getAddress = getAddress;
const produceSigningStargateClient = async (rpcEndpoint, liquidator, gasPrice = '0.025uosmo') => {
    const protoRegistry = [
        ...osmojs_1.cosmosProtoRegistry,
        ...osmojs_1.cosmwasmProtoRegistry,
        ...osmojs_1.ibcProtoRegistry,
        ...osmojs_1.osmosisProtoRegistry,
    ];
    const aminoConverters = {
        ...osmojs_1.cosmosAminoConverters,
        ...osmojs_1.cosmwasmAminoConverters,
        ...osmojs_1.ibcAminoConverters,
        ...osmojs_1.osmosisAminoConverters,
    };
    const registry = new proto_signing_1.Registry(protoRegistry);
    const aminoTypes = new stargate_1.AminoTypes(aminoConverters);
    const clientOption = {
        gasPrice: stargate_1.GasPrice.fromString(gasPrice),
        registry,
        aminoTypes,
        broadcastPollIntervalMs: 1000,
        broadcastTimeoutMs: 300000,
    };
    return await stargate_1.SigningStargateClient.connectWithSigner(rpcEndpoint, liquidator, clientOption);
};
exports.produceSigningStargateClient = produceSigningStargateClient;
const produceReadOnlyCosmWasmClient = async (rpcEndpoint) => {
    return await cosmwasm_stargate_1.SigningCosmWasmClient.connect(rpcEndpoint);
};
exports.produceReadOnlyCosmWasmClient = produceReadOnlyCosmWasmClient;
const produceSigningCosmWasmClient = async (rpcEndpoint, liquidator, gasPrice = '0.025uosmo') => {
    return await cosmwasm_stargate_1.SigningCosmWasmClient.connectWithSigner(rpcEndpoint, liquidator, {
        gasPrice: stargate_1.GasPrice.fromString(gasPrice),
        broadcastPollIntervalMs: 1000,
        broadcastTimeoutMs: 300000,
    });
};
exports.produceSigningCosmWasmClient = produceSigningCosmWasmClient;
const findUnderlying = (lpToken, pools) => {
    const poolId = lpToken.split('/').pop();
    const pool = pools.find((pool) => pool.id.toString() === poolId);
    if (!pool)
        return undefined;
    return [pool.token0, pool.token1];
};
exports.findUnderlying = findUnderlying;
const setPrice = async (client, deployerAddress, assetDenom, price, oracleAddress) => {
    const msg = {
        set_price_source: {
            denom: assetDenom,
            price_source: {
                fixed: { price: price },
            },
        },
    };
    await client.execute(deployerAddress, oracleAddress, msg, 'auto');
};
exports.setPrice = setPrice;
const seedAddresses = async (client, sender, accounts, coins) => {
    const seededAddresses = [];
    const sendTokenMsgs = [];
    console.log(`seeding children for ${sender}`);
    accounts.forEach((account) => {
        if (account.address === sender)
            return;
        const addressToSeed = account.address;
        const msg = {
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: {
                fromAddress: sender,
                toAddress: addressToSeed,
                amount: coins,
            },
        };
        sendTokenMsgs.push(msg);
        seededAddresses.push(addressToSeed);
    });
    await client.signAndBroadcast(sender, sendTokenMsgs, 'auto');
    return seededAddresses;
};
exports.seedAddresses = seedAddresses;
const withdraw = async (client, sender, assetDenom, amount, addresses) => {
    const msg = {
        withdraw: {
            denom: assetDenom,
            amount: amount,
        },
    };
    return await client.execute(sender, addresses.redBank, msg, 'auto');
};
exports.withdraw = withdraw;
const borrow = async (client, sender, assetDenom, amount, redbankAddress) => {
    const msg = {
        borrow: {
            denom: assetDenom,
            amount: amount,
        },
    };
    return await client.execute(sender, redbankAddress, msg, 'auto');
};
exports.borrow = borrow;
const produceExecuteContractMessage = (sender, contract, msg, funds = []) => {
    const executeContractMsg = {
        typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
        value: {
            sender,
            contract,
            msg,
            funds,
        },
    };
    return executeContractMsg;
};
exports.produceExecuteContractMessage = produceExecuteContractMessage;
const produceSendMessage = (sender, recipient, funds) => {
    return {
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: {
            fromAddress: sender,
            toAddress: recipient,
            amount: funds,
        },
    };
};
exports.produceSendMessage = produceSendMessage;
const produceDepositMessage = (sender, redBankContractAddress, coins) => {
    const executeContractMsg = {
        typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
        value: {
            sender: sender,
            contract: redBankContractAddress,
            msg: (0, encoding_1.toUtf8)(`{ "deposit": {} }`),
            funds: coins,
        },
    };
    return executeContractMsg;
};
exports.produceDepositMessage = produceDepositMessage;
const produceBorrowMessage = (sender, assetDenom, amount, redBankContractAddress) => {
    const executeContractMsg = {
        typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
        value: {
            sender: sender,
            contract: redBankContractAddress,
            msg: (0, encoding_1.toUtf8)(`{ "borrow": { "denom": "${assetDenom}", "amount": "${amount}" }}`),
            funds: [],
        },
    };
    return executeContractMsg;
};
exports.produceBorrowMessage = produceBorrowMessage;
const produceWithdrawMessage = (sender, assetDenom, redBankContractAddress) => {
    const msg = (0, encoding_1.toUtf8)(`
      { 
        "withdraw": { 
          "denom": "${assetDenom}"
        } 
      }`);
    return (0, exports.produceExecuteContractMessage)(sender, redBankContractAddress, msg, []);
};
exports.produceWithdrawMessage = produceWithdrawMessage;
const produceRepayMessage = (sender, redBankContractAddress, coins) => {
    const executeContractMsg = {
        typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
        value: {
            sender: sender,
            contract: redBankContractAddress,
            msg: (0, encoding_1.toUtf8)(`{ "repay" : {} }`),
            funds: coins,
        },
    };
    return executeContractMsg;
};
exports.produceRepayMessage = produceRepayMessage;
const produceSwapMessage = (liquidatorAddress, tokenIn, route) => {
    const msg = swapExactAmountIn({
        sender: liquidatorAddress,
        routes: route,
        tokenIn: tokenIn,
        tokenOutMinAmount: '1',
    });
    const executeContractMsg = {
        typeUrl: msg.typeUrl,
        value: msg.value,
    };
    return executeContractMsg;
};
exports.produceSwapMessage = produceSwapMessage;
const deposit = async (client, sender, assetDenom, amount, redbankAddress) => {
    const msg = { deposit: {} };
    const coins = [
        {
            denom: assetDenom,
            amount: amount,
        },
    ];
    return await client.execute(sender, redbankAddress, msg, 'auto', undefined, coins);
};
exports.deposit = deposit;
const repay = async (client, sender, assetDenom, amount, addresses) => {
    const msg = { repay: { denom: assetDenom } };
    const coins = [
        {
            denom: assetDenom,
            amount: amount,
        },
    ];
    return await client.execute(sender, addresses.redBank, msg, 'auto', undefined, coins);
};
exports.repay = repay;
const queryHealth = async (client, address, redbankAddress) => {
    const msg = { user_position: { user: address } };
    return await client.queryContractSmart(redbankAddress, msg);
};
exports.queryHealth = queryHealth;
function readArtifact(name = 'artifact') {
    try {
        const data = (0, fs_1.readFileSync)(name, 'utf8');
        return JSON.parse(data);
    }
    catch (e) {
        return {};
    }
}
exports.readArtifact = readArtifact;
const loadSeeds = () => {
    const data = readArtifact(`seeds.json`);
    return data;
};
exports.loadSeeds = loadSeeds;
//# sourceMappingURL=helpers.js.map