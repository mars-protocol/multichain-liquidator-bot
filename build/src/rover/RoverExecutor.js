"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoverExecutor = void 0;
const BaseExecutor_1 = require("../BaseExecutor");
const helpers_1 = require("../helpers");
const encoding_1 = require("@cosmjs/encoding");
const hive_1 = require("../query/hive");
const LiquidationActionGenerator_1 = require("./LiquidationActionGenerator");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const RoverPosition_1 = require("./types/RoverPosition");
const errors_1 = require("./constants/errors");
class RoverExecutor extends BaseExecutor_1.BaseExecutor {
    constructor(config, client, queryClient, wallet, poolProvider) {
        super(config, client, queryClient, poolProvider);
        this.VAULT_RELOAD_WINDOW = 1800000;
        this.creditLines = [];
        this.creditLineCaps = [];
        this.liquidatorAccounts = new Map();
        this.liquidatorBalances = new Map();
        this.whitelistedCoins = [];
        this.vaults = [];
        this.vaultDetails = new Map();
        this.lastFetchedVaultTime = 0;
        this.start = async () => {
            await this.initiateRedis();
            await this.initiateAstroportPoolProvider();
            await this.refreshData();
            const accounts = await this.wallet.getAccounts();
            const liquidatorAddresses = accounts
                .slice(1, this.config.maxLiquidators + 1)
                .map((account) => account.address);
            await this.topUpWallets(liquidatorAddresses);
            const createCreditAccountpromises = [];
            liquidatorAddresses.map((address) => createCreditAccountpromises.push(this.createCreditAccount(address)));
            const results = await Promise.all(createCreditAccountpromises);
            results.forEach((result) => this.liquidatorAccounts.set(result.liquidatorAddress, result.tokenId));
            setInterval(this.refreshData, 30 * 1000);
            setInterval(this.updateLiquidatorBalances, 20 * 1000);
            setInterval(this.run, 200);
        };
        this.updateLiquidatorBalances = async () => {
            const liquidatorAddresses = Array.from(this.liquidatorAccounts.keys());
            await this.topUpWallets(liquidatorAddresses);
        };
        this.topUpWallets = async (addresses) => {
            const balances = await (0, hive_1.fetchBalances)(this.config.hiveEndpoint, addresses);
            this.liquidatorBalances = balances;
            const sendMsgs = [];
            const amountToSend = this.config.minGasTokens * 2;
            for (const balanceKey of Array.from(balances.keys())) {
                const osmoBalance = Number(balances.get(balanceKey)?.find((coin) => coin.denom === this.config.gasDenom)?.amount || 0);
                if (osmoBalance === undefined || osmoBalance < this.config.minGasTokens) {
                    sendMsgs.push((0, helpers_1.produceSendMessage)(this.config.liquidatorMasterAddress, balanceKey, [{ denom: this.config.gasDenom, amount: amountToSend.toFixed(0) }]));
                }
            }
            if (sendMsgs.length > 0) {
                await this.client.signAndBroadcast(this.config.liquidatorMasterAddress, sendMsgs, 'auto');
                console.log(`topped up ${sendMsgs.length} wallets`);
            }
        };
        this.fetchVaults = async () => {
            let foundAll = false;
            const limit = 5;
            let vaults = [];
            let startAfter = undefined;
            while (!foundAll) {
                const vaultQuery = {
                    vaults_info: {
                        limit,
                        start_after: startAfter,
                    },
                };
                const results = await this.queryClient.queryContractSmart(this.config.creditManagerAddress, vaultQuery);
                vaults = vaults.concat(results);
                if (results.length < limit) {
                    foundAll = true;
                }
                startAfter = results.pop()?.vault;
            }
            return vaults;
        };
        this.refreshData = async () => {
            const currentTimeMs = Date.now();
            if (this.lastFetchedVaultTime + this.VAULT_RELOAD_WINDOW < currentTimeMs) {
                const vaultsData = await this.fetchVaults();
                this.vaults = vaultsData.map((vaultData) => vaultData.vault.address);
                this.lastFetchedVaultTime = currentTimeMs;
            }
            const roverData = await (0, hive_1.fetchRoverData)(this.config.hiveEndpoint, this.config.liquidatorMasterAddress, this.config.redbankAddress, this.config.oracleAddress, this.config.creditManagerAddress, this.config.swapperAddress, this.vaults);
            await this.refreshMarketData();
            roverData.masterBalance.forEach((coin) => this.balances.set(coin.denom, Number(coin.amount)));
            roverData.prices.forEach((price) => this.prices.set(price.denom, Number(price.price)));
            this.whitelistedCoins = roverData.whitelistedAssets;
            this.vaultDetails = roverData.vaultInfo;
            this.creditLines = roverData.creditLines;
            this.creditLineCaps = roverData.creditLineCaps;
            this.liquidationActionGenerator.setSwapperRoutes(roverData.routes);
            await this.refreshPoolData();
        };
        this.createCreditAccount = async (liquidatorAddress) => {
            let { tokens } = await this.queryClient.queryContractSmart(this.config.accountNftAddress, {
                tokens: { owner: liquidatorAddress },
            });
            if (tokens.length === 0) {
                const result = await this.client.signAndBroadcast(liquidatorAddress, [
                    (0, helpers_1.produceExecuteContractMessage)(liquidatorAddress, this.config.creditManagerAddress, (0, encoding_1.toUtf8)(`{ "create_credit_account": {} }`)),
                ], 'auto');
                if (result.code !== 0) {
                    throw new Error(`Failed to create credit account for ${liquidatorAddress}. TxHash: ${result.transactionHash}`);
                }
                const { tokens: updatedTokens } = await this.queryClient.queryContractSmart(this.config.accountNftAddress, {
                    tokens: { owner: liquidatorAddress },
                });
                tokens = updatedTokens;
            }
            return { liquidatorAddress, tokenId: tokens[0] };
        };
        this.run = async () => {
            const targetAccounts = await this.redis.popUnhealthyPositions(this.config.maxLiquidators);
            if (targetAccounts.length == 0) {
                await (0, helpers_1.sleep)(200);
                console.log(' - No items for liquidation yet');
                return;
            }
            const liquidatorAddressesIterator = this.liquidatorAccounts.keys();
            const liquidationPromises = [];
            for (const targetAccount of targetAccounts) {
                const next = liquidatorAddressesIterator.next();
                const liquidatorAddress = next.value;
                liquidationPromises.push(this.liquidate(targetAccount, liquidatorAddress));
            }
            await Promise.all(liquidationPromises);
        };
        this.liquidate = async (accountId, liquidatorAddress) => {
            console.log(`liquidating ${accountId}`);
            const roverPosition = await (0, hive_1.fetchRoverPosition)(accountId, this.config.creditManagerAddress, this.config.hiveEndpoint);
            const bestCollateral = this.findBestCollateral(roverPosition.deposits, roverPosition.vaults);
            const bestDebt = this.findBestDebt(roverPosition.debts.map((debtAmount) => {
                return { amount: debtAmount.amount, denom: debtAmount.denom };
            }));
            const borrowActions = this.liquidationActionGenerator.produceBorrowActions(bestDebt, bestCollateral, this.markets, this.whitelistedCoins, this.creditLines, this.creditLineCaps);
            const { borrow } = borrowActions[0];
            const liquidateMessage = this.liquidationActionGenerator.produceLiquidationAction(bestCollateral.type, { denom: bestDebt.denom, amount: borrow.amount }, roverPosition.account_id, bestCollateral.denom, bestCollateral.vaultType);
            const vault = this.vaultDetails.get(bestCollateral.denom);
            const collateralToDebtActions = this.liquidationActionGenerator.convertCollateralToDebt(bestCollateral.denom, borrow, vault);
            const repayMsg = this.liquidationActionGenerator.generateRepayActions(borrow.denom);
            const swapToStableMsg = borrow.denom !== this.config.neutralAssetDenom
                ? this.liquidationActionGenerator.generateSwapActions(borrow.denom, this.config.neutralAssetDenom, '100')
                : [];
            const refundAll = this.liquidationActionGenerator.produceRefundAllAction();
            const actions = [
                ...borrowActions,
                liquidateMessage,
                ...collateralToDebtActions,
                ...repayMsg,
                ...swapToStableMsg,
                refundAll,
            ];
            const liquidatorAccountId = this.liquidatorAccounts.get(liquidatorAddress);
            const msg = {
                update_credit_account: { account_id: liquidatorAccountId, actions },
            };
            const msgs = [
                (0, helpers_1.produceExecuteContractMessage)(liquidatorAddress, this.config.creditManagerAddress, (0, encoding_1.toUtf8)(JSON.stringify(msg))),
            ];
            const liquidatorBalances = this.liquidatorBalances.get(liquidatorAddress);
            const stable = liquidatorBalances?.find((coin) => coin.denom === this.config.neutralAssetDenom);
            if (stable !== undefined && new bignumber_js_1.default(stable.amount).isGreaterThan(this.config.stableBalanceThreshold)) {
                const sendMsg = (0, helpers_1.produceSendMessage)(liquidatorAddress, this.config.liquidatorMasterAddress, [stable]);
                msgs.push(sendMsg);
            }
            const result = await this.client.signAndBroadcast(liquidatorAddress, msgs, 'auto');
            if (result.code !== 0) {
                console.log(`Liquidation failed. TxHash: ${result.transactionHash}`);
            }
            else {
                console.log(`Liquidation successfull. TxHash: ${result.transactionHash}`);
            }
        };
        this.findBestCollateral = (collaterals, vaultPositions) => {
            const largestCollateralCoin = collaterals
                .sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB))
                .pop();
            const largestCollateralVault = vaultPositions
                .sort((vaultA, vaultB) => this.calculateVaultValue(vaultA).value - this.calculateVaultValue(vaultB).value)
                .pop();
            const bestCollateral = this.calculateCoinValue(largestCollateralCoin) >
                this.calculateVaultValue(largestCollateralVault).value
                ? largestCollateralCoin
                : largestCollateralVault;
            if (!bestCollateral)
                throw new Error('Failed to find a collateral');
            const isVault = bestCollateral.vault !== undefined;
            if (isVault) {
                const { value, type } = this.calculateVaultValue(bestCollateral);
                return {
                    amount: 0,
                    value,
                    denom: bestCollateral.vault.address,
                    closeFactor: 0.5,
                    price: 0,
                    type: RoverPosition_1.PositionType.VAULT,
                    vaultType: type,
                };
            }
            const amount = Number(bestCollateral.amount);
            const value = amount * (this.prices.get(bestCollateral.denom) || 0);
            return {
                amount,
                value,
                denom: bestCollateral.denom,
                closeFactor: 0.5,
                price: this.prices.get(bestCollateral.denom) || 0,
                type: RoverPosition_1.PositionType.COIN,
            };
        };
        this.calculateCoinValue = (coin) => {
            if (!coin)
                return 0;
            const amountBn = new bignumber_js_1.default(coin?.amount);
            const price = new bignumber_js_1.default(this.prices.get(coin.denom) || 0);
            return amountBn.multipliedBy(price).toNumber();
        };
        this.calculateVaultSharesValue = (shares, vaultAddress) => {
            const vault = this.vaultDetails.get(vaultAddress);
            if (!vault)
                throw new Error(errors_1.UNSUPPORTED_VAULT);
            const positionLpShares = shares.multipliedBy(vault.lpShareToVaultShareRatio);
            const lpSharePrice = this.prices.get(vault.baseToken) || 0;
            if (lpSharePrice === 0)
                throw new Error(errors_1.UNSUPPORTED_ASSET);
            return positionLpShares.multipliedBy(lpSharePrice);
        };
        this.calculateVaultValue = (vault) => {
            if (!vault)
                return { value: 0, type: 'l_o_c_k_e_d' };
            const vaultAmountLocked = new bignumber_js_1.default(vault.amount.locking.locked);
            const vaultAmountUnlocked = new bignumber_js_1.default(vault.amount.unlocked);
            const unlockingAmounts = JSON.parse(JSON.stringify(vault.amount.locking.unlocking));
            const largestUnlocking = unlockingAmounts
                .sort((unlockA, unlockB) => this.calculateCoinValue(unlockA.coin) - this.calculateCoinValue(unlockB.coin))
                .pop()?.coin;
            const safeLocked = vaultAmountLocked.isNaN() ? new bignumber_js_1.default(0) : vaultAmountLocked;
            const safeUnlocked = vaultAmountUnlocked.isNaN() ? new bignumber_js_1.default(0) : vaultAmountUnlocked;
            const vaultAmount = safeLocked.isGreaterThan(safeUnlocked)
                ? vaultAmountLocked
                : vaultAmountUnlocked;
            let vaultType = safeLocked.isGreaterThan(safeUnlocked)
                ? 'l_o_c_k_e_d'
                : 'u_n_l_o_c_k_e_d';
            const largestVaultValue = this.calculateVaultSharesValue(vaultAmount, vault.vault.address);
            const largestUnlockingValue = largestUnlocking
                ? new bignumber_js_1.default(largestUnlocking.amount).multipliedBy(this.prices.get(largestUnlocking.denom) || 0)
                : new bignumber_js_1.default(0);
            if (largestVaultValue.isNaN() || largestUnlockingValue.isGreaterThan(largestVaultValue)) {
                vaultType = 'u_n_l_o_c_k_i_n_g';
            }
            const value = largestVaultValue.isGreaterThan(largestUnlockingValue)
                ? largestVaultValue.toNumber()
                : largestUnlockingValue.toNumber();
            return { value, type: vaultType };
        };
        this.findBestDebt = (debts) => {
            const largestDebt = debts
                .sort((coinA, coinB) => this.calculateCoinValue(coinA) - this.calculateCoinValue(coinB))
                .pop();
            if (!largestDebt)
                throw new Error('Failed to find any debts');
            return {
                amount: Number(largestDebt.amount),
                denom: largestDebt.denom,
                price: this.prices.get(largestDebt.denom) || 0,
            };
        };
        this.config = config;
        this.liquidationActionGenerator = new LiquidationActionGenerator_1.LiquidationActionGenerator(this.ammRouter);
        this.wallet = wallet;
    }
}
exports.RoverExecutor = RoverExecutor;
//# sourceMappingURL=RoverExecutor.js.map