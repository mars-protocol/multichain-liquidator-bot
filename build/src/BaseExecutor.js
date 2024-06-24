"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseExecutor = void 0;
const redis_js_1 = require("./redis.js");
const AmmRouter_js_1 = require("./AmmRouter.js");
require("dotenv/config.js");
const CsvWriter_js_1 = require("./CsvWriter.js");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const hive_js_1 = require("./query/hive.js");
class BaseExecutor {
    constructor(config, client, queryClient, poolProvider, redis = new redis_js_1.RedisInterface(), ammRouter = new AmmRouter_js_1.AMMRouter()) {
        this.config = config;
        this.client = client;
        this.queryClient = queryClient;
        this.poolProvider = poolProvider;
        this.redis = redis;
        this.ammRouter = ammRouter;
        this.prices = new Map();
        this.balances = new Map();
        this.markets = [];
        this.poolsNextRefresh = 0;
        this.csvLogger = new CsvWriter_js_1.CSVWriter('./results.csv', [
            { id: 'blockHeight', title: 'BlockHeight' },
            { id: 'userAddress', title: 'User' },
            { id: 'estimatedLtv', title: 'LiquidationLtv' },
            { id: 'debtRepaid', title: 'debtRepaid' },
            { id: 'collateral', title: 'collateral' },
            { id: 'liquidatorBalance', title: 'liquidatorBalance' },
        ]);
        this.applyAvailableLiquidity = (market) => {
            const scalingFactor = 1e6;
            const scaledDeposits = new bignumber_js_1.default(market.collateral_total_scaled);
            const scaledBorrows = new bignumber_js_1.default(market.debt_total_scaled);
            const descaledDeposits = scaledDeposits
                .multipliedBy(market.liquidity_index)
                .dividedBy(scalingFactor);
            const descaledBorrows = scaledBorrows.multipliedBy(market.borrow_index).dividedBy(scalingFactor);
            const availableLiquidity = descaledDeposits.minus(descaledBorrows);
            market.available_liquidity = availableLiquidity.toNumber();
            return market;
        };
        this.setBalances = async (liquidatorAddress) => {
            const coinBalances = await this.client.getAllBalances(liquidatorAddress);
            for (const index in coinBalances) {
                const coin = coinBalances[index];
                this.balances.set(coin.denom, Number(coin.amount));
            }
        };
        this.addCsvRow = (row) => {
            this.csvLogger.addRow(row);
        };
        this.writeCsv = async () => {
            await this.csvLogger.writeToFile();
        };
        this.refreshData = async () => {
            const { wasm, bank } = await (0, hive_js_1.fetchRedbankData)(this.config.hiveEndpoint, this.config.liquidatorMasterAddress, this.config.redbankAddress, this.config.oracleAddress);
            bank.balance.forEach((coin) => this.balances.set(coin.denom, Number(coin.amount)));
            wasm.prices.forEach((price) => this.prices.set(price.denom, Number(price.price)));
            await this.refreshMarketData();
        };
        this.refreshMarketData = async () => {
            let markets = [];
            let fetching = true;
            let start_after = "";
            while (fetching) {
                const response = await this.queryClient.queryContractSmart(this.config.redbankAddress, {
                    markets: {
                        start_after,
                    },
                });
                start_after = response[response.length - 1] ? response[response.length - 1].denom : "";
                markets = markets.concat(response);
                fetching = response.length === 5;
            }
            this.markets = markets.map((market) => this.applyAvailableLiquidity(market));
        };
        this.refreshPoolData = async () => {
            const currentTime = Date.now();
            if (this.poolsNextRefresh < currentTime) {
                const pools = await this.poolProvider.loadPools();
                this.ammRouter.setPools(pools);
                this.poolsNextRefresh = Date.now() + this.config.poolsRefreshWindow;
            }
        };
    }
    async initiateRedis() {
        await this.redis.connect(this.config.redisEndpoint);
    }
    async initiateAstroportPoolProvider() {
        const astroportPoolProvider = this.poolProvider;
        if (astroportPoolProvider) {
            await astroportPoolProvider.initiate();
        }
    }
}
exports.BaseExecutor = BaseExecutor;
//# sourceMappingURL=BaseExecutor.js.map