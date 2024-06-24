"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const amino_1 = require("@cosmjs/amino");
const proto_signing_1 = require("@cosmjs/proto-signing");
const redis_js_1 = require("../../../src/redis.js");
const helpers_js_1 = require("../../../src/helpers.js");
require("dotenv/config.js");
const RedbankExecutor_1 = require("../../../src/redbank/RedbankExecutor");
const config_js_1 = require("./config.js");
const Osmosis_js_1 = require("../../../src/execute/Osmosis.js");
const OsmosisPoolProvider_1 = require("../../../src/query/amm/OsmosisPoolProvider");
const AstroportRouteRequester_js_1 = require("../../../src/query/amm/AstroportRouteRequester.js");
const EXECUTOR_QUEUE = 'executor_queue';
const redisInterface = new redis_js_1.RedisInterface();
const runTest = async (testConfig, numberOfPositions) => {
    console.log(`Running test with ${numberOfPositions} positions`);
    const redisClient = await redisInterface.connect();
    const accountNumbers = [];
    accountNumbers.push(0);
    while (accountNumbers.length <= numberOfPositions + 1) {
        accountNumbers.push(Number((Math.random() * 1e6).toFixed(0)));
    }
    const hdPaths = accountNumbers.map((value) => (0, amino_1.makeCosmoshubPath)(value));
    const wallet = await proto_signing_1.DirectSecp256k1HdWallet.fromMnemonic(testConfig.seed, {
        hdPaths: hdPaths,
        prefix: 'osmo',
    });
    const accounts = await wallet.getAccounts();
    const cwClient = await (0, helpers_js_1.produceSigningCosmWasmClient)(testConfig.rpcEndpoint, wallet);
    const sgClient = await (0, helpers_js_1.produceSigningStargateClient)(testConfig.rpcEndpoint, wallet);
    const deployerAddress = accounts[0].address;
    const liquidatorAccount = accounts[1].address;
    console.log('seeding redbank');
    await sgClient.sendTokens(deployerAddress, liquidatorAccount, [{ amount: '1000000', denom: testConfig.usdcDenom }], 'auto');
    await sgClient.sendTokens(deployerAddress, liquidatorAccount, [{ amount: '1000000', denom: testConfig.gasDenom }], 'auto');
    await sgClient.sendTokens(deployerAddress, testConfig.redbankAddress, [{ amount: '10000000', denom: testConfig.atomDenom }], 'auto');
    const config = {
        gasDenom: 'uosmo',
        chainName: "osmosis",
        hiveEndpoint: testConfig.hiveEndpoint,
        lcdEndpoint: testConfig.lcdEndpoint,
        liquidatableAssets: ['osmo', 'atom', 'usdc'],
        neutralAssetDenom: 'usdc',
        liquidatorMasterAddress: liquidatorAccount,
        liquidationFiltererAddress: testConfig.liquidationFiltererAddress,
        oracleAddress: testConfig.oracleAddress,
        redbankAddress: testConfig.redbankAddress,
        safetyMargin: 0.05,
        logResults: true,
        queueName: 'redbank-queue',
        redisEndpoint: '',
        poolsRefreshWindow: 60000,
        astroportApi: "https://app.astroport.fi/api/",
    };
    const osmoToSend = { amount: '11000000', denom: testConfig.gasDenom };
    const atomToSend = { amount: '10000000', denom: testConfig.atomDenom };
    const useableAddresses = await (0, helpers_js_1.seedAddresses)(cwClient, deployerAddress, accounts.slice(2, 2 + numberOfPositions), [atomToSend, osmoToSend]);
    console.log(`setting prices`);
    await (0, helpers_js_1.setPrice)(cwClient, deployerAddress, testConfig.gasDenom, '1', testConfig.oracleAddress);
    await (0, helpers_js_1.setPrice)(cwClient, deployerAddress, testConfig.atomDenom, '1', testConfig.oracleAddress);
    console.log(`seeding redbank with intial deposit`);
    await sgClient.sendTokens(deployerAddress, testConfig.redbankAddress, [{ amount: '10000000000', denom: testConfig.atomDenom }], 'auto');
    await sgClient.sendTokens(deployerAddress, testConfig.redbankAddress, [{ amount: '10000000000', denom: testConfig.gasDenom }], 'auto');
    console.log('Setting up positions');
    const length = useableAddresses.length;
    let index = 0;
    while (index < length) {
        const address = useableAddresses[index];
        try {
            await (0, helpers_js_1.deposit)(cwClient, address, testConfig.gasDenom, '10000', testConfig.redbankAddress);
            await (0, helpers_js_1.borrow)(cwClient, address, testConfig.atomDenom, '3000', testConfig.redbankAddress);
            console.log(`created position for address ${address}`);
        }
        catch (e) {
            console.log(`error occurred creating positions for ${address}`);
            console.log(e);
        }
        index += 1;
    }
    await pushPositionsToRedis(useableAddresses, redisClient, EXECUTOR_QUEUE);
    await (0, helpers_js_1.setPrice)(cwClient, deployerAddress, testConfig.atomDenom, '2.2', testConfig.oracleAddress);
    const initialBalance = {
        uosmo: await cwClient.getBalance(liquidatorAccount, testConfig.gasDenom),
        atom: await cwClient.getBalance(liquidatorAccount, testConfig.atomDenom),
        usdc: await cwClient.getBalance(liquidatorAccount, testConfig.usdcDenom),
    };
    const poolProvider = new OsmosisPoolProvider_1.OsmosisPoolProvider(testConfig.lcdEndpoint);
    const exchangeInterface = new Osmosis_js_1.Osmosis();
    const api = new AstroportRouteRequester_js_1.AstroportRouteRequester();
    console.log(`================= executing liquidations =================`);
    await dispatchLiquidations(sgClient, cwClient, config, poolProvider, exchangeInterface, api);
    for (const index in useableAddresses) {
        const health = await (0, helpers_js_1.queryHealth)(cwClient, useableAddresses[index], testConfig.redbankAddress);
        if (Number(health.health_status.borrowing.liq_threshold_hf) < 1) {
            console.log(`${useableAddresses[index]} is still unhealthy`);
        }
        else {
            console.log(`${useableAddresses[index]} is healthy`);
        }
    }
    const updatedBalance = {
        uosmo: await cwClient.getBalance(liquidatorAccount, testConfig.gasDenom),
        atom: await cwClient.getBalance(liquidatorAccount, testConfig.atomDenom),
        usdc: await cwClient.getBalance(liquidatorAccount, testConfig.usdcDenom),
    };
    console.log({
        updatedBalance,
        initialBalance,
    });
    const gains = Number(updatedBalance.usdc.amount) - Number(initialBalance.usdc.amount);
    if (gains < 0) {
        console.error('ERROR : Updated balance was smaller than initial balance. Asset');
    }
    else {
        console.log('Successfully completed liquidations :)');
        console.log(`Gained ${gains}`);
    }
};
const pushPositionsToRedis = async (addresses, redisClient, queueName) => {
    for (const index in addresses) {
        console.log(`pushing position to redis: ${addresses[index]}`);
        const position = {
            Identifier: addresses[index],
        };
        await redisClient.lPush(queueName, JSON.stringify(position));
    }
};
const dispatchLiquidations = async (client, cwClient, config, poolProvider, exchangeInterface, routeRequestApi) => {
    const executor = new RedbankExecutor_1.RedbankExecutor(config, client, cwClient, poolProvider, exchangeInterface, routeRequestApi);
    await executor.initiateRedis();
    await executor.run();
};
const main = async () => {
    const config = config_js_1.localnetConfig;
    await runTest(config, 1);
    await runTest(config, 5);
};
main().catch((e) => {
    console.log(e);
    process.exit(1);
});
//# sourceMappingURL=liquidationTest.js.map