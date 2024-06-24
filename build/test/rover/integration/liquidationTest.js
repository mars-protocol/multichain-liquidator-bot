"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../../../src/helpers");
const roverTestHelpers_1 = require("./roverTestHelpers");
const MarsCreditManager_client_1 = require("marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.client");
const MarsAccountNft_client_1 = require("marsjs-types/creditmanager/generated/mars-account-nft/MarsAccountNft.client");
const proto_signing_1 = require("@cosmjs/proto-signing");
const RoverExecutor_1 = require("../../../src/rover/RoverExecutor");
const amino_1 = require("@cosmjs/amino");
const encoding_1 = require("@cosmjs/encoding");
const config_1 = require("./config");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const redis_1 = require("../../../src/redis");
const OsmosisPoolProvider_1 = require("../../../src/query/amm/OsmosisPoolProvider");
const runTests = async (testConfig) => {
    const results = {
        simpleCoin: false,
        marketDisabled: false,
        coinDisabled: false,
        creditLineExceeded: false,
        illiquidRedbank: false,
        lpTokenCollateral: false,
        lockedVault: false,
        unlockingVault: false,
        unlockedVault: false,
        coinBigger: false,
        vaultBigger: false,
        liquidateMany: false
    };
    const maxLiquidators = 10;
    const accountIndexes = Array.from(Array(maxLiquidators).keys());
    const { client, cwClient, wallet } = await createServices(testConfig.rpcEndpoint, testConfig.creditManagerAddress, testConfig.accountNFTAddress, testConfig.seed, testConfig.prefix, accountIndexes);
    const masterAddress = (await wallet.getAccounts())[0].address;
    const exec = new MarsCreditManager_client_1.MarsCreditManagerClient(cwClient, masterAddress, testConfig.creditManagerAddress);
    console.log('Master account setup complete');
    console.log({ masterAddress });
    if (testConfig.seedRedbankRequired) {
        await seedRedbank(client, masterAddress, testConfig);
        console.log('Seeded redbank');
    }
    const config = {
        redbankAddress: testConfig.redbankAddress,
        oracleAddress: testConfig.oracleAddress,
        chainName: "osmosis",
        swapperAddress: testConfig.swapperAddress,
        accountNftAddress: testConfig.accountNFTAddress,
        gasDenom: testConfig.gasDenom,
        hiveEndpoint: testConfig.hiveEndpoint,
        lcdEndpoint: testConfig.lcdEndpoint,
        liquidatorMasterAddress: masterAddress,
        creditManagerAddress: testConfig.creditManagerAddress,
        minGasTokens: 100000,
        logResults: true,
        neutralAssetDenom: testConfig.usdcDenom,
        redisEndpoint: '',
        poolsRefreshWindow: 60000,
        maxLiquidators,
        stableBalanceThreshold: 10000000
    };
    const poolProvider = new OsmosisPoolProvider_1.OsmosisPoolProvider(testConfig.lcdEndpoint);
    const executorLiquidator = new RoverExecutor_1.RoverExecutor(config, client, cwClient, wallet, poolProvider);
    await executorLiquidator.initiateRedis();
    await executorLiquidator.refreshData();
    if (testConfig.tests.lockedVault) {
        results.lockedVault = await runLockedVaultTest(testConfig, cwClient, client, executorLiquidator, masterAddress, config, exec);
    }
    if (testConfig.tests.lpTokenCollateral) {
        results.lpTokenCollateral = await lpCoinLiquidate(testConfig, cwClient, client, executorLiquidator, masterAddress, config, exec);
    }
    if (testConfig.tests.unlockingVault) {
        results.unlockingVault = await runUnlockingVaultTest(testConfig, cwClient, client, executorLiquidator, masterAddress, config);
    }
    if (testConfig.tests.simpleCoin) {
        results.simpleCoin = await runCoinBorrowTest(testConfig, cwClient, client, executorLiquidator, masterAddress, config);
    }
    if (testConfig.tests.marketDisabled) {
        results.marketDisabled = await liquidateCoinWithMarketDisabled(testConfig, cwClient, client, executorLiquidator, masterAddress, config);
    }
    if (testConfig.tests.illiquidRedbank) {
        results.illiquidRedbank = await runIlliquidRedbankTest(testConfig, client, executorLiquidator, masterAddress);
    }
    if (testConfig.tests.creditLineExceeded) {
        results.creditLineExceeded = await runCreditLineExceededCoinTest(testConfig, client, executorLiquidator, masterAddress);
    }
    if (testConfig.tests.coinDisabled) {
        results.coinDisabled = await nonWhitelistedCoinTest(testConfig, cwClient, client, executorLiquidator, masterAddress, config, exec);
    }
    if (testConfig.tests.liquidateMany) {
        results.liquidateMany = await runLiquidateAllTest(testConfig, cwClient, client, executorLiquidator, masterAddress, config);
    }
    console.log('Finished All Test Cases');
    console.log({ results });
};
const runLiquidateAllTest = async (testConfig, cwClient, client, executor, masterAddress, config) => {
    try {
        console.log('Starting liquidate multiple test');
        const queueName = process.env.LIQUIDATION_QUEUE_NAME;
        const redisClient = await new redis_1.RedisInterface().connect();
        const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom);
        const amount = '100000';
        const victimAccountId1 = await createVictimCoinPosition(testConfig, client, masterAddress, [{ denom: 'uosmo', amount: '140000' }], {
            amount: amount,
            denom: 'uosmo',
        }, {
            amount: new bignumber_js_1.default(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
            denom: testConfig.atomDenom,
        });
        const victimAccountId2 = await createVictimCoinPosition(testConfig, client, masterAddress, [{ denom: 'uosmo', amount: '140000' }], {
            amount: amount,
            denom: 'uosmo',
        }, {
            amount: new bignumber_js_1.default(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
            denom: testConfig.atomDenom,
        });
        const victimAccountId3 = await createVictimCoinPosition(testConfig, client, masterAddress, [{ denom: 'uosmo', amount: '140000' }], {
            amount: amount,
            denom: 'uosmo',
        }, {
            amount: new bignumber_js_1.default(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
            denom: testConfig.atomDenom,
        });
        const accountIds = [victimAccountId1, victimAccountId2, victimAccountId3];
        await redisClient.lPush(queueName, accountIds);
        await (0, helpers_1.setPrice)(cwClient, masterAddress, testConfig.atomDenom, estimatedPrice.multipliedBy(1.35).toFixed(6), config.oracleAddress);
        await executor.start();
        let liquidated = false;
        let startTime = Date.now();
        const second = 1000;
        while (!liquidated && startTime + (20 * second) > Date.now()) {
            const healthFactorPromises = accountIds.map((accountId) => cwClient.queryContractSmart(testConfig.creditManagerAddress, { health: { account_id: accountId } }));
            const newHealthFactorResults = await Promise.all(healthFactorPromises);
            liquidated = (!newHealthFactorResults[0].liquidatable && !newHealthFactorResults[1].liquidatable && !newHealthFactorResults[2].liquidatable);
            if (liquidated) {
                console.log(newHealthFactorResults);
            }
            await (0, helpers_1.sleep)(1 * second);
        }
        if (!liquidated) {
            console.log('Failed to liquidate all positions');
        }
        console.log('Finished multi liquidation test');
        return liquidated;
    }
    catch (e) {
        console.error(e);
        return false;
    }
    finally {
        await resetPrice(testConfig.atomDenom, testConfig.oracleAddress, masterAddress, testConfig.osmoAtomPoolId, client);
        process.exit(0);
    }
};
const runUnlockingVaultTest = async (testConfig, cwClient, client, executor, masterAddress, config) => {
    console.log('Starting unlocking vault test');
    try {
        const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom);
        const depositAmount = '10000';
        const victimAccountId = await createVictimVaultPosition(testConfig, masterAddress, [{ denom: testConfig.gasDenom, amount: '110000' }], client, { denom: testConfig.gasDenom, amount: depositAmount }, {
            denom: testConfig.atomDenom,
            amount: new bignumber_js_1.default(depositAmount).dividedBy(estimatedPrice).toFixed(0),
        }, 'u_n_l_o_c_k_i_n_g');
        console.log('created vault position');
        await (0, helpers_1.setPrice)(cwClient, masterAddress, testConfig.atomDenom, estimatedPrice.multipliedBy(2).toFixed(6), config.oracleAddress);
        await executor.liquidate(victimAccountId, masterAddress);
    }
    catch (e) {
        console.error(e);
        return false;
    }
    finally {
        await resetPrice(testConfig.atomDenom, testConfig.oracleAddress, masterAddress, testConfig.osmoAtomPoolId, client);
    }
    console.log('Finished vault test');
    return true;
};
const runLockedVaultTest = async (testConfig, cwClient, client, executor, masterAddress, config, exec) => {
    try {
        console.log('Testing locked vault');
        const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom);
        await exec.updateConfig({
            updates: {
                allowed_coins: [
                    'uosmo',
                    testConfig.usdcDenom,
                    testConfig.atomDenom,
                    testConfig.osmoAtomPoolDenom,
                ],
            },
        });
        const depositAmount = '10000';
        const victimAccountId = await createVictimVaultPosition(testConfig, masterAddress, [{ denom: testConfig.gasDenom, amount: '110000' }], client, { denom: testConfig.gasDenom, amount: depositAmount }, {
            denom: testConfig.atomDenom,
            amount: new bignumber_js_1.default(depositAmount).dividedBy(estimatedPrice).toFixed(0),
        }, 'l_o_c_k_e_d');
        console.log('created vault position');
        await (0, helpers_1.setPrice)(cwClient, masterAddress, testConfig.atomDenom, estimatedPrice.multipliedBy(2).toFixed(6), config.oracleAddress);
        await executor.liquidate(victimAccountId, masterAddress);
        await resetPrice(testConfig.atomDenom, testConfig.oracleAddress, masterAddress, testConfig.osmoAtomPoolId, client);
    }
    catch (e) {
        console.log(e);
        return false;
    }
    console.log('Finished vault test');
    return true;
};
const runCoinBorrowTest = async (testConfig, cwClient, client, executor, masterAddress, config) => {
    try {
        console.log('Starting simple coin test');
        const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom);
        const amount = '100000';
        const victimAccountId = await createVictimCoinPosition(testConfig, client, masterAddress, [{ denom: 'uosmo', amount: '140000' }], {
            amount: amount,
            denom: 'uosmo',
        }, {
            amount: new bignumber_js_1.default(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
            denom: 'uatom',
        });
        await (0, helpers_1.setPrice)(cwClient, masterAddress, testConfig.atomDenom, estimatedPrice.multipliedBy(1.4).toFixed(6), config.oracleAddress);
        await executor.liquidate(victimAccountId, masterAddress);
        console.log('Finished simple test');
    }
    catch (e) {
        console.error(e);
        return false;
    }
    finally {
        await resetPrice(testConfig.atomDenom, testConfig.oracleAddress, masterAddress, testConfig.osmoAtomPoolId, client);
    }
    return true;
};
const lpCoinLiquidate = async (testConfig, cwClient, client, executor, masterAddress, config, exec) => {
    try {
        console.log('Starting lpCoin test');
        await exec.updateConfig({
            updates: {
                allowed_coins: [
                    'uosmo',
                    testConfig.usdcDenom,
                    testConfig.atomDenom,
                    testConfig.osmoAtomPoolDenom,
                ],
            },
        });
        const { mnemonic } = await proto_signing_1.DirectSecp256k1HdWallet.generate(24);
        const { address: victimAddress, exec: vExec, nft: vNft, } = await createServices(testConfig.rpcEndpoint, testConfig.creditManagerAddress, testConfig.accountNFTAddress, mnemonic, testConfig.prefix);
        const gammPriceMsg = {
            set_price_source: {
                denom: testConfig.osmoAtomPoolDenom,
                price_source: { xyk_liquidity_token: { pool_id: 1 } },
            },
        };
        const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom);
        const atomPriceMsg = {
            set_price_source: {
                denom: testConfig.atomDenom,
                price_source: { fixed: { price: estimatedPrice.toFixed(6) } },
            },
        };
        await client.signAndBroadcast(masterAddress, [
            (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.oracleAddress, (0, encoding_1.toUtf8)(JSON.stringify(gammPriceMsg))),
            (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.oracleAddress, (0, encoding_1.toUtf8)(JSON.stringify(atomPriceMsg))),
        ], 'auto');
        const amount = '100000';
        const depositCoin = {
            amount: amount,
            denom: 'uosmo',
        };
        const borrowCoin = {
            amount: new bignumber_js_1.default(amount).times(estimatedPrice).toFixed(0),
            denom: 'uatom',
        };
        await client.sendTokens(masterAddress, victimAddress, [{ amount: (Number(amount) * 1.1).toFixed(0), denom: 'uosmo' }], 'auto');
        const victimAccountId = await (0, roverTestHelpers_1.createCreditAccount)(victimAddress, vNft, vExec);
        const liquidityCoins = [
            { denom: borrowCoin.denom, amount: { exact: borrowCoin.amount } },
            { denom: depositCoin.denom, amount: { exact: depositCoin.amount } },
        ];
        const provideLiquidity = {
            provide_liquidity: {
                coins_in: liquidityCoins,
                lp_token_out: testConfig.osmoAtomPoolDenom,
                minimum_receive: '1',
            },
        };
        await (0, roverTestHelpers_1.updateCreditAccount)([
            {
                deposit: depositCoin,
            },
            {
                borrow: borrowCoin,
            },
            provideLiquidity,
        ], victimAccountId, vExec, [{ amount: depositCoin.amount, denom: 'uosmo' }]);
        await (0, helpers_1.setPrice)(cwClient, masterAddress, testConfig.atomDenom, estimatedPrice.multipliedBy(2).toFixed(6), config.oracleAddress);
        await executor.refreshData();
        await executor.liquidate(victimAccountId, masterAddress);
        console.log('Finished simple test');
    }
    catch (e) {
        console.error(e);
        return false;
    }
    finally {
        await resetPrice(testConfig.atomDenom, testConfig.oracleAddress, masterAddress, testConfig.osmoAtomPoolId, client);
        await exec.updateConfig({
            updates: {
                allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
            },
        });
    }
    return true;
};
const liquidateCoinWithMarketDisabled = async (testConfig, cwClient, client, executor, masterAddress, config) => {
    try {
        console.log('Starting disabled market test');
        const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom);
        const amount = '100000';
        const victimAccountId = await createVictimCoinPosition(testConfig, client, masterAddress, [{ denom: 'uosmo', amount: '140000' }], {
            amount: amount,
            denom: 'uosmo',
        }, {
            amount: new bignumber_js_1.default(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
            denom: testConfig.atomDenom,
        });
        await updateMarketBorrow(client, masterAddress, testConfig.redbankAddress, testConfig.atomDenom, false);
        await executor.refreshData();
        await (0, helpers_1.setPrice)(cwClient, masterAddress, testConfig.atomDenom, estimatedPrice.multipliedBy(1.4).toFixed(6), config.oracleAddress);
        await executor.liquidate(victimAccountId, masterAddress);
        console.log('Completed market disabled test');
    }
    catch (e) {
        console.log(e);
        return false;
    }
    finally {
        await updateMarketBorrow(client, masterAddress, testConfig.redbankAddress, testConfig.atomDenom, true);
        await resetPrice(testConfig.atomDenom, testConfig.oracleAddress, masterAddress, testConfig.osmoAtomPoolId, client);
    }
    return true;
};
const runIlliquidRedbankTest = async (testConfig, client, executor, masterAddress) => {
    try {
        console.log('Starting illiquid market test');
        const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom);
        const amount = '100000';
        const victimAccountId = await createVictimCoinPosition(testConfig, client, masterAddress, [{ denom: 'uosmo', amount: '140000' }], {
            amount: amount,
            denom: 'uosmo',
        }, {
            amount: new bignumber_js_1.default(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
            denom: testConfig.atomDenom,
        });
        await executor.refreshData();
        const priceMsg = {
            set_price_source: {
                denom: testConfig.atomDenom,
                price_source: {
                    fixed: { price: estimatedPrice.multipliedBy(1.5).toFixed(6) },
                },
            },
        };
        const marketLiquidity = executor.markets.find((marketInfo) => marketInfo.denom === testConfig.atomDenom)
            ?.available_liquidity || 0;
        const creditLineMsg = {
            update_uncollateralized_loan_limit: {
                user: masterAddress,
                denom: testConfig.atomDenom,
                new_limit: '1000000000000',
            },
        };
        const borrowAmount = (marketLiquidity - 100).toFixed(0);
        const borrowMessage = { borrow: { denom: testConfig.atomDenom, amount: borrowAmount } };
        console.log('updating tests');
        await client.signAndBroadcast(masterAddress, [
            (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.redbankAddress, (0, encoding_1.toUtf8)(JSON.stringify(creditLineMsg))),
            (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.oracleAddress, (0, encoding_1.toUtf8)(JSON.stringify(priceMsg))),
            (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.redbankAddress, (0, encoding_1.toUtf8)(JSON.stringify(borrowMessage))),
        ], 'auto');
        await executor.refreshData();
        await executor.liquidate(victimAccountId, masterAddress);
        console.log('Completed illiquid market test');
    }
    catch (e) {
        console.log(e);
        return false;
    }
    finally {
        await resetPrice(testConfig.atomDenom, testConfig.oracleAddress, masterAddress, testConfig.osmoAtomPoolId, client);
    }
    return true;
};
const runCreditLineExceededCoinTest = async (testConfig, client, executor, masterAddress) => {
    try {
        console.log('Starting creditLine exceeded test');
        const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom);
        const amount = '100000';
        const victimAccountId = await createVictimCoinPosition(testConfig, client, masterAddress, [{ denom: 'uosmo', amount: '140000' }], {
            amount: amount,
            denom: 'uosmo',
        }, {
            amount: new bignumber_js_1.default(amount).dividedBy(estimatedPrice).dividedBy(2).toFixed(0),
            denom: testConfig.atomDenom,
        });
        const priceMsg = {
            set_price_source: {
                denom: testConfig.atomDenom,
                price_source: {
                    fixed: { price: estimatedPrice.multipliedBy(1.6).toFixed(6) },
                },
            },
        };
        const creditLineMsg = {
            update_uncollateralized_loan_limit: {
                user: testConfig.creditManagerAddress,
                denom: testConfig.atomDenom,
                new_limit: '1',
            },
        };
        await client.signAndBroadcast(masterAddress, [
            (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.redbankAddress, (0, encoding_1.toUtf8)(JSON.stringify(creditLineMsg))),
            (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.oracleAddress, (0, encoding_1.toUtf8)(JSON.stringify(priceMsg))),
        ], 'auto');
        await executor.refreshData();
        await executor.liquidate(victimAccountId, masterAddress);
        console.log('Completed credit line exceeded test');
    }
    catch (e) {
        console.error(e);
        return false;
    }
    finally {
        const resetAtomPriceMsg = {
            set_price_source: {
                denom: testConfig.atomDenom,
                price_source: {
                    arithmetic_twap: { pool_id: testConfig.osmoAtomPoolId, window_size: 1800 },
                },
            },
        };
        await client.signAndBroadcast(masterAddress, [
            (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.redbankAddress, (0, encoding_1.toUtf8)(JSON.stringify({
                update_uncollateralized_loan_limit: {
                    user: testConfig.creditManagerAddress,
                    denom: testConfig.atomDenom,
                    new_limit: '10000000000',
                },
            }))),
            (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.oracleAddress, (0, encoding_1.toUtf8)(JSON.stringify(resetAtomPriceMsg))),
        ], 'auto');
    }
    return true;
};
const nonWhitelistedCoinTest = async (testConfig, cwClient, client, executor, masterAddress, config, exec) => {
    try {
        console.log('Starting non whitelisted coin test');
        const estimatedPrice = getEstimatedPoolPrice(executor.ammRouter, testConfig.atomDenom);
        const victimAccount = await createVictimCoinPosition(testConfig, client, masterAddress, [{ denom: 'uosmo', amount: '1100000' }], {
            amount: '1000000',
            denom: 'uosmo',
        }, {
            amount: '500000',
            denom: testConfig.atomDenom,
        });
        await (0, helpers_1.setPrice)(cwClient, masterAddress, testConfig.atomDenom, estimatedPrice.multipliedBy(1.4).toFixed(6), config.oracleAddress);
        await exec.updateConfig({
            updates: {
                allowed_coins: ['uosmo', testConfig.usdcDenom],
            },
        });
        await executor.refreshData();
        await executor.liquidate(victimAccount, masterAddress);
    }
    catch (e) {
        console.error(e);
        return false;
    }
    finally {
        await resetPrice(testConfig.atomDenom, testConfig.oracleAddress, masterAddress, testConfig.osmoAtomPoolId, client);
        await exec.updateConfig({
            updates: {
                allowed_coins: ['uosmo', testConfig.usdcDenom, testConfig.atomDenom],
            },
        });
    }
    return true;
};
const createServices = async (rpcEndpoint, creditManagerAddress, accountNft, seed, prefix, accountIndexes = [0]) => {
    const wallet = accountIndexes.length === 1
        ? await (0, helpers_1.getWallet)(seed, prefix)
        : await (0, helpers_1.getWallet)(seed, prefix, accountIndexes.map((index) => (0, amino_1.makeCosmoshubPath)(index)));
    const accounts = await wallet.getAccounts();
    const address = accounts[accountIndexes[0]].address;
    const client = await (0, helpers_1.produceSigningStargateClient)(rpcEndpoint, wallet);
    const cwClient = await (0, helpers_1.produceSigningCosmWasmClient)(rpcEndpoint, wallet);
    const exec = new MarsCreditManager_client_1.MarsCreditManagerClient(cwClient, address, creditManagerAddress);
    const query = new MarsCreditManager_client_1.MarsCreditManagerQueryClient(cwClient, creditManagerAddress);
    const nft = new MarsAccountNft_client_1.MarsAccountNftQueryClient(cwClient, accountNft);
    return {
        client,
        cwClient,
        exec,
        query,
        nft,
        wallet,
        address,
    };
};
const updateMarketBorrow = async (client, masterAddress, redbankAddress, marketDenom, enabled) => {
    await client.signAndBroadcast(masterAddress, [
        (0, helpers_1.produceExecuteContractMessage)(masterAddress, redbankAddress, (0, encoding_1.toUtf8)(JSON.stringify({
            update_asset: {
                denom: marketDenom,
                params: {
                    borrow_enabled: enabled,
                },
            },
        }))),
    ], 'auto');
};
const resetPrice = async (denom, oracleAddress, masterAddress, poolId, client) => {
    const resetAtomPriceMsg = {
        set_price_source: {
            denom: denom,
            price_source: { arithmetic_twap: { pool_id: poolId, window_size: 1800 } },
        },
    };
    await client.signAndBroadcast(masterAddress, [
        (0, helpers_1.produceExecuteContractMessage)(masterAddress, oracleAddress, (0, encoding_1.toUtf8)(JSON.stringify(resetAtomPriceMsg))),
    ], 'auto');
};
const getEstimatedPoolPrice = (ammRouter, assetDenom) => {
    const amountOut = new bignumber_js_1.default(1000000000);
    const osmoAtomRoute = ammRouter.getBestRouteGivenOutput(assetDenom, 'uosmo', amountOut);
    const estimatedPrice = amountOut.dividedBy(ammRouter.getRequiredInput(amountOut, osmoAtomRoute));
    return estimatedPrice;
};
const seedRedbank = async (client, masterAddress, testConfig) => {
    await client.signAndBroadcast(masterAddress, [
        (0, helpers_1.produceExecuteContractMessage)(masterAddress, testConfig.redbankAddress, (0, encoding_1.toUtf8)(JSON.stringify({ deposit: {} })), [
            {
                denom: 'uosmo',
                amount: '2000000',
            },
        ]),
    ], 'auto');
};
const createVictimVaultPosition = async (testConfig, masterAddress, coinsForVictim, masterClient, depositCoin, borrowCoin, vaultState) => {
    const { mnemonic } = await proto_signing_1.DirectSecp256k1HdWallet.generate(24);
    const { address: victimAddress, exec, nft: vNft, } = await createServices(testConfig.rpcEndpoint, testConfig.creditManagerAddress, testConfig.accountNFTAddress, mnemonic, testConfig.prefix);
    await masterClient.sendTokens(masterAddress, victimAddress, coinsForVictim, 'auto');
    const victimAccountId = await (0, roverTestHelpers_1.createCreditAccount)(victimAddress, vNft, exec);
    const liquidityCoins = [
        { denom: borrowCoin.denom, amount: { exact: borrowCoin.amount } },
        { denom: depositCoin.denom, amount: { exact: depositCoin.amount } },
    ];
    if (vaultState === 'u_n_l_o_c_k_e_d') {
        throw new Error('Creating unlocked states currently not supported');
    }
    const vaultStateModifier = vaultState === 'u_n_l_o_c_k_i_n_g'
        ? {
            request_vault_unlock: {
                amount: '100000000000',
                vault: {
                    address: testConfig.vaults[0],
                },
            },
        }
        : undefined;
    const actions = [
        {
            deposit: depositCoin,
        },
        {
            borrow: borrowCoin,
        },
        {
            provide_liquidity: {
                coins_in: liquidityCoins,
                lp_token_out: testConfig.osmoAtomPoolDenom,
                minimum_receive: '1',
            },
        },
        {
            enter_vault: {
                coin: {
                    denom: testConfig.osmoAtomPoolDenom,
                    amount: 'account_balance',
                },
                vault: {
                    address: testConfig.vaults[0],
                },
            },
        },
    ];
    if (vaultStateModifier) {
        actions.push(vaultStateModifier);
    }
    await exec.updateCreditAccount({ accountId: victimAccountId, actions }, 'auto', undefined, [
        depositCoin,
    ]);
    return victimAccountId;
};
const createVictimCoinPosition = async (testConfig, masterClient, masterAddress, coinsForVictim, depositCoin, borrowCoin) => {
    const { mnemonic } = await proto_signing_1.DirectSecp256k1HdWallet.generate(24);
    const { address: victimAddress, exec: vExec, nft: vNft, } = await createServices(testConfig.rpcEndpoint, testConfig.creditManagerAddress, testConfig.accountNFTAddress, mnemonic, testConfig.prefix);
    await masterClient.sendTokens(masterAddress, victimAddress, coinsForVictim, 'auto');
    const victimAccountId = await (0, roverTestHelpers_1.createCreditAccount)(victimAddress, vNft, vExec);
    console.log({ borrowCoin });
    await (0, roverTestHelpers_1.updateCreditAccount)([
        {
            deposit: depositCoin,
        },
        {
            borrow: borrowCoin,
        },
        {
            withdraw: borrowCoin,
        },
    ], victimAccountId, vExec, [{ amount: depositCoin.amount, denom: testConfig.gasDenom }]);
    return victimAccountId;
};
const main = async () => {
    await runTests(config_1.testnetConfig);
};
main().then(() => process.exit());
//# sourceMappingURL=liquidationTest.js.map