"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const stargate_1 = require("@cosmjs/stargate");
const helpers_js_1 = require("./helpers.js");
const RedbankExecutor_1 = require("./redbank/RedbankExecutor");
const secretManager_1 = require("./secretManager");
const network_1 = require("./types/network");
const OsmosisPoolProvider_js_1 = require("./query/amm/OsmosisPoolProvider.js");
const AstroportPoolProvider_js_1 = require("./query/amm/AstroportPoolProvider.js");
const Osmosis_js_1 = require("./execute/Osmosis.js");
const getConfig_js_1 = require("./redbank/config/getConfig.js");
const AstroportCW_js_1 = require("./execute/AstroportCW.js");
const proto_signing_1 = require("@cosmjs/proto-signing");
const AstroportRouteRequester_js_1 = require("./query/amm/AstroportRouteRequester.js");
const REDBANK = 'Redbank';
const ROVER = 'Rover';
const main = async () => {
    console.log("STARTED");
    const executorType = process.env.EXECUTOR_TYPE;
    const sm = (0, secretManager_1.getSecretManager)();
    const addressCount = process.env.MAX_LIQUIDATORS || 1;
    const chainName = process.env.CHAIN_NAME;
    const prefix = process.env.CHAIN_PREFIX;
    const hdPaths = [];
    while (hdPaths.length < Number(addressCount)) {
        hdPaths.push((0, stargate_1.makeCosmoshubPath)(hdPaths.length));
    }
    const liquidator = await proto_signing_1.DirectSecp256k1HdWallet.fromMnemonic(await sm.getSeedPhrase(), {
        prefix,
        hdPaths,
    });
    const liquidatorMasterAddress = (await liquidator.getAccounts())[0].address;
    const queryClient = await (0, helpers_js_1.produceReadOnlyCosmWasmClient)(process.env.RPC_ENDPOINT);
    const client = await (0, helpers_js_1.produceSigningStargateClient)(process.env.RPC_ENDPOINT, liquidator);
    const networkEnv = process.env.NETWORK || "LOCALNET";
    const network = networkEnv === "MAINNET" ? network_1.Network.MAINNET : networkEnv === "TESTNET" ? network_1.Network.TESTNET : network_1.Network.LOCALNET;
    const redbankConfig = (0, getConfig_js_1.getConfig)(liquidatorMasterAddress, network, chainName);
    const exchangeInterface = chainName === "osmosis" ? new Osmosis_js_1.Osmosis() : new AstroportCW_js_1.AstroportCW(prefix, redbankConfig.astroportRouter);
    const routeRequester = chainName === "neutron" ? new AstroportRouteRequester_js_1.AstroportRouteRequester() : undefined;
    const poolProvider = getPoolProvider(chainName, redbankConfig);
    switch (executorType) {
        case REDBANK:
            await launchRedbank(client, queryClient, redbankConfig, poolProvider, exchangeInterface, routeRequester);
            return;
        case ROVER:
            throw new Error('Rover not supported by MarsV1');
        default:
            throw new Error(`Invalid executor type. Executor type must be either ${REDBANK} or ${ROVER}, recieved ${executorType}`);
    }
};
exports.main = main;
const getPoolProvider = (chainName, config) => {
    switch (chainName) {
        case "osmosis":
            return new OsmosisPoolProvider_js_1.OsmosisPoolProvider(process.env.LCD_ENDPOINT);
        case "neutron":
            return new AstroportPoolProvider_js_1.AstroportPoolProvider(config.astroportFactory, process.env.HIVE_ENDPOINT, process.env.LCD_ENDPOINT);
        default:
            throw new Error(`Invalid chain name. Chain name must be either osmosis or neutron, recieved ${chainName}`);
    }
};
const launchRedbank = async (client, wasmClient, redbankConfig, poolProvider, exchangeInterface, apiRequester) => {
    await new RedbankExecutor_1.RedbankExecutor(redbankConfig, client, wasmClient, poolProvider, exchangeInterface, apiRequester).start();
};
(0, exports.main)().catch((e) => {
    console.log(e);
    process.exit(1);
});
//# sourceMappingURL=main.js.map