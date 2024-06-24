"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedbankExecutor = void 0;
const encoding_1 = require("@cosmjs/encoding");
const proto_signing_1 = require("@cosmjs/proto-signing");
const helpers_js_1 = require("../helpers.js");
const osmojs_1 = require("osmojs");
require("dotenv/config.js");
const hive_js_1 = require("../query/hive.js");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const BaseExecutor_js_1 = require("../BaseExecutor.js");
const liquidationGenerator_js_1 = require("../liquidationGenerator.js");
const { executeContract } = osmojs_1.cosmwasm.wasm.v1.MessageComposer.withTypeUrl;
class RedbankExecutor extends BaseExecutor_js_1.BaseExecutor {
    constructor(config, client, queryClient, poolProvider, exchangeInterface, routeRequestApi) {
        super(config, client, queryClient, poolProvider);
        this.exchangeInterface = exchangeInterface;
        this.routeRequestApi = routeRequestApi;
        this.executeViaRedbankMsg = (tx) => {
            const msg = JSON.stringify({
                liquidate: { user: tx.user_address, collateral_denom: tx.collateral_denom },
            });
            return (0, helpers_js_1.produceExecuteContractMessage)(this.config.liquidatorMasterAddress, this.config.redbankAddress, (0, encoding_1.toUtf8)(msg), [
                {
                    amount: tx.amount,
                    denom: tx.debt_denom,
                },
            ]);
        };
        this.executeViaFilterer = (txs, debtCoins) => {
            const msg = (0, encoding_1.toUtf8)(JSON.stringify({ liquidate_many: { liquidations: txs } }));
            return (0, helpers_js_1.produceExecuteContractMessage)(this.config.liquidatorMasterAddress, this.config.liquidationFiltererAddress, msg, debtCoins);
        };
        this.runLiquidation = async (liquidateeAddress, liquidatorAddress) => {
            await this.withdrawAndSwapCollateral(liquidatorAddress);
            const positionData = await (0, hive_js_1.fetchRedbankBatch)([{ Identifier: liquidateeAddress }], this.config.redbankAddress, this.config.hiveEndpoint);
            console.log(`- found ${positionData.length} positions queued for liquidation. `);
            const { txs, debtsToRepay } = this.produceLiquidationTxs(positionData);
            const debtCoins = [];
            debtsToRepay.forEach((amount, denom) => debtCoins.push({ denom, amount: amount.toFixed(0) }));
            const firstMsgBatch = [];
            this.appendSwapToDebtMessages(debtCoins, liquidatorAddress, firstMsgBatch, new bignumber_js_1.default(this.balances.get(this.config.neutralAssetDenom)));
            const execute = txs.length == 1 ? this.executeViaRedbankMsg(txs[0]) : this.executeViaFilterer(txs, debtCoins);
            firstMsgBatch.push(execute);
            if (!firstMsgBatch || firstMsgBatch.length === 0 || txs.length === 0)
                return;
            const result = await this.client.signAndBroadcast(this.config.liquidatorMasterAddress, firstMsgBatch, await this.getFee(firstMsgBatch, this.config.liquidatorMasterAddress));
            await this.withdrawAndSwapCollateral(liquidatorAddress);
            this.redis.incrementBy('executor.liquidations.executed', txs.length);
            console.log(`- Successfully liquidated ${txs.length} positions`);
            if (this.config.logResults) {
                txs.forEach((tx) => {
                    this.addCsvRow({
                        blockHeight: result.height,
                        collateral: tx.collateral_denom,
                        debtRepaid: tx.debt_denom,
                        estimatedLtv: '0',
                        userAddress: tx.user_address,
                        liquidatorBalance: Number(this.balances.get(this.config.neutralAssetDenom) || 0),
                    });
                });
            }
            console.log(`- Liquidation Process Complete.`);
            if (this.config.logResults) {
                this.writeCsv();
            }
        };
        this.withdrawAndSwapCollateral = async (liquidatorAddress) => {
            const collaterals = await this.queryClient?.queryContractSmart(this.config.redbankAddress, { user_collaterals: { user: liquidatorAddress } });
            let secondBatch = [];
            const balances = await this.client?.getAllBalances(liquidatorAddress);
            const combinedCoins = this.combineBalances(collaterals, balances);
            this.appendWithdrawMessages(collaterals, liquidatorAddress, secondBatch);
            await this.appendSwapToNeutralMessages(combinedCoins, liquidatorAddress, secondBatch);
            if (secondBatch.length > 0) {
                await this.client.signAndBroadcast(this.config.liquidatorMasterAddress, secondBatch, await this.getFee(secondBatch, this.config.liquidatorMasterAddress));
            }
        };
        this.getFee = async (msgs, address) => {
            if (!this.client)
                throw new Error('Stargate Client is undefined, ensure you call initiate at before calling this method');
            const gasEstimated = await this.client.simulate(address, msgs, '');
            const fee = {
                amount: (0, proto_signing_1.coins)(60000, this.config.gasDenom),
                gas: Number(gasEstimated * 1.3).toFixed(0),
            };
            return fee;
        };
        console.log({ config });
        this.config = config;
    }
    async start() {
        await this.refreshData();
        while (true) {
            try {
                await this.run();
            }
            catch (e) {
                console.log('ERROR:', e);
            }
        }
    }
    produceLiquidationTxs(positionData) {
        const txs = [];
        const debtsToRepay = new Map();
        let totalDebtValue = (0, bignumber_js_1.default)(0);
        const availableValue = new bignumber_js_1.default(this.balances.get(this.config.neutralAssetDenom) || 0);
        positionData.forEach(async (positionResponse) => {
            const positionAddress = Object.keys(positionResponse.data)[0];
            const position = positionResponse.data[positionAddress];
            if (position.collaterals.length > 0 && position.debts.length > 0) {
                const largestCollateralDenom = (0, liquidationGenerator_js_1.getLargestCollateral)(position.collaterals, this.prices);
                const largestDebt = (0, liquidationGenerator_js_1.getLargestDebt)(position.debts, this.prices);
                if (availableValue.isGreaterThan(1000)) {
                    const debtPrice = this.prices.get(largestDebt.denom);
                    const debtValue = new bignumber_js_1.default(largestDebt.amount).multipliedBy(debtPrice);
                    const amountToLiquidate = availableValue.isGreaterThan(debtValue)
                        ? new bignumber_js_1.default(largestDebt.amount)
                        : availableValue.dividedBy(debtPrice).multipliedBy(0.95);
                    const liquidateTx = {
                        collateral_denom: largestCollateralDenom,
                        debt_denom: largestDebt.denom,
                        user_address: positionAddress,
                        amount: amountToLiquidate.toFixed(0),
                    };
                    const newTotalDebt = totalDebtValue.plus(new bignumber_js_1.default(amountToLiquidate).multipliedBy(debtPrice));
                    txs.push(liquidateTx);
                    const existingDebt = debtsToRepay.get(liquidateTx.debt_denom) || 0;
                    debtsToRepay.set(liquidateTx.debt_denom, new bignumber_js_1.default(amountToLiquidate).plus(existingDebt));
                    totalDebtValue = newTotalDebt;
                }
                else {
                    console.warn(`WARNING - not enough size to liquidate this position - user address : ${[
                        positionAddress,
                    ]}`);
                }
            }
        });
        return { txs, debtsToRepay };
    }
    appendWithdrawMessages(collateralsWon, liquidatorAddress, msgs) {
        collateralsWon.forEach((collateral) => {
            const denom = collateral.denom;
            msgs.push(executeContract((0, helpers_js_1.produceWithdrawMessage)(liquidatorAddress, denom, this.config.redbankAddress)
                .value));
        });
        return msgs;
    }
    async appendSwapToNeutralMessages(collaterals, liquidatorAddress, msgs) {
        let expectedNeutralCoinAmount = new bignumber_js_1.default(0);
        for (const collateral of collaterals) {
            if (collateral.denom === this.config.neutralAssetDenom)
                continue;
            let collateralAmount = collateral.denom === this.config.gasDenom
                ? new bignumber_js_1.default(collateral.amount).minus(100000000)
                : new bignumber_js_1.default(collateral.amount);
            if (collateralAmount.isGreaterThan(1000) && !collateralAmount.isNaN()) {
                let { route, expectedOutput, } = await this.routeRequestApi.requestRoute("https://app.astroport.fi/api/", collateral.denom, this.config.neutralAssetDenom, collateralAmount.toFixed(0));
                const minOutput = new bignumber_js_1.default(expectedOutput)
                    .multipliedBy(0.975)
                    .toFixed(0);
                expectedNeutralCoinAmount = expectedNeutralCoinAmount.plus(minOutput);
                msgs.push(this.exchangeInterface.produceSwapMessage(route, { denom: collateral.denom, amount: collateralAmount.toFixed(0) }, minOutput, liquidatorAddress));
            }
        }
        return expectedNeutralCoinAmount;
    }
    async appendSwapToDebtMessages(debtsToRepay, liquidatorAddress, msgs, neutralAvailable) {
        let remainingNeutral = neutralAvailable;
        const expectedDebtAssetsPostSwap = new Map();
        for (const debt of debtsToRepay) {
            if (debt.denom === this.config.neutralAssetDenom) {
                const cappedAmount = remainingNeutral.isLessThan(debt.amount)
                    ? remainingNeutral
                    : new bignumber_js_1.default(debt.amount);
                remainingNeutral = neutralAvailable.minus(cappedAmount.minus(1));
                const totalDebt = cappedAmount.plus(expectedDebtAssetsPostSwap.get(debt.denom) || 0);
                expectedDebtAssetsPostSwap.set(debt.denom, totalDebt);
            }
            else {
                let debtPrice = this.prices.get(debt.denom);
                if (!debtPrice) {
                    throw new Error(`No price for debt: ${debt.denom}`);
                }
                let amountToSwap = new bignumber_js_1.default(debt.amount).multipliedBy(debtPrice);
                amountToSwap = amountToSwap.isGreaterThan(neutralAvailable) ? neutralAvailable : amountToSwap;
                let { route, expectedOutput, } = await this.routeRequestApi.requestRoute("https://app.astroport.fi/api/", this.config.neutralAssetDenom, debt.denom, amountToSwap.toFixed(0));
                msgs.push(this.exchangeInterface.produceSwapMessage(route, { denom: this.config.neutralAssetDenom, amount: amountToSwap.toFixed(0) }, expectedOutput, liquidatorAddress));
                expectedDebtAssetsPostSwap.set(debt.denom, new bignumber_js_1.default(expectedOutput));
            }
        }
        return expectedDebtAssetsPostSwap;
    }
    async run() {
        const liquidatorAddress = this.config.liquidatorMasterAddress;
        if (!this.queryClient || !this.client)
            throw new Error("Instantiate your clients before calling 'run()'");
        await this.refreshData();
        console.log('Checking for liquidations');
        const url = `${this.config.marsEndpoint}/v1/unhealthy_positions/${this.config.chainName.toLowerCase()}/redbank`;
        const response = await fetch(url);
        let targetAccountObjects = (await response.json())['data'];
        const targetAccounts = targetAccountObjects.filter((account) => account.total_debt.length > 3)
            .sort((accountA, accountB) => Number(accountB.total_debt) - Number(accountA.total_debt));
        if (targetAccounts.length == 0) {
            await (0, helpers_js_1.sleep)(2000);
            return;
        }
        for (const account of targetAccounts) {
            console.log("running liquidation for account: ", account.account_id);
            try {
                await this.runLiquidation(account.account_id, liquidatorAddress);
            }
            catch (e) {
                console.log('ERROR:', e);
            }
        }
    }
    combineBalances(collaterals, balances) {
        const coinMap = new Map();
        collaterals.forEach((collateral) => coinMap.set(collateral.denom, {
            denom: collateral.denom,
            amount: Number(collateral.amount).toFixed(0),
        }));
        balances.forEach((balance) => {
            const denom = balance.denom;
            const amount = balance.amount;
            const existingBalance = coinMap.get(denom)?.amount || 0;
            const newBalance = (Number(existingBalance) + Number(amount)).toFixed(0);
            const newCoin = { denom, amount: newBalance };
            coinMap.set(denom, newCoin);
        });
        const result = [];
        coinMap.forEach((coin) => result.push(coin));
        return result;
    }
}
exports.RedbankExecutor = RedbankExecutor;
//# sourceMappingURL=RedbankExecutor.js.map