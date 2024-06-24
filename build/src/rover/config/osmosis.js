"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = void 0;
const network_1 = require("../../types/network");
const getConfig = (liquidatorMasterAddress, network) => {
    if (network === network_1.Network.MAINNET) {
        return {
            gasDenom: 'uosmo',
            chainName: "osmosis",
            hiveEndpoint: process.env.HIVE_ENDPOINT,
            lcdEndpoint: process.env.LCD_ENDPOINT,
            neutralAssetDenom: 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858',
            swapperAddress: 'osmo1wee0z8c7tcawyl647eapqs4a88q8jpa7ddy6nn2nrs7t47p2zhxswetwla',
            oracleAddress: 'osmo1mhznfr60vjdp2gejhyv2gax9nvyyzhd3z0qcwseyetkfustjauzqycsy2g',
            redbankAddress: 'osmo1c3ljch9dfw5kf52nfwpxd2zmj2ese7agnx0p9tenkrryasrle5sqf3ftpg',
            accountNftAddress: 'osmo1450hrg6dv2l58c0rvdwx8ec2a0r6dd50hn4frk370tpvqjhy8khqw7sw09',
            creditManagerAddress: 'osmo1f2m24wktq0sw3c0lexlg7fv4kngwyttvzws3a3r3al9ld2s2pvds87jqvf',
            liquidatorMasterAddress: liquidatorMasterAddress,
            minGasTokens: 10000000,
            logResults: false,
            redisEndpoint: process.env.REDIS_ENDPOINT || '',
            poolsRefreshWindow: 60000,
            maxLiquidators: 100,
            stableBalanceThreshold: 5000000
        };
    }
    return {
        gasDenom: 'uosmo',
        chainName: "osmosis",
        hiveEndpoint: process.env.HIVE_ENDPOINT,
        lcdEndpoint: process.env.LCD_ENDPOINT,
        neutralAssetDenom: 'uosmo',
        swapperAddress: 'osmo1svc92mfvgfredd56ut83sy68vwzvd5nxu7844ljmlsrsxa8d8lssw7kd4x',
        oracleAddress: 'osmo1dqz2u3c8rs5e7w5fnchsr2mpzzsxew69wtdy0aq4jsd76w7upmsstqe0s8',
        redbankAddress: 'osmo1t0dl6r27phqetfu0geaxrng0u9zn8qgrdwztapt5xr32adtwptaq6vwg36',
        accountNftAddress: 'osmo16wwckvccarltl4mlnjhw3lcj3v59yglhldgw36ldkknmjavqyaasgcessw',
        creditManagerAddress: 'osmo1dzk4y3s9am6773sglhfc60nstz09c3gy978h2jka6wre5z4hlavq4pcwk0',
        liquidatorMasterAddress: liquidatorMasterAddress,
        minGasTokens: 10000000,
        logResults: false,
        redisEndpoint: process.env.REDIS_ENDPOINT || '',
        poolsRefreshWindow: 60000,
        maxLiquidators: 100,
        stableBalanceThreshold: 5000000
    };
};
exports.getConfig = getConfig;
//# sourceMappingURL=osmosis.js.map