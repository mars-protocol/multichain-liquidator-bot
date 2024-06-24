"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = void 0;
const network_1 = require("../../types/network");
const getConfig = (liquidatorMasterAddress, network) => {
    return network === network_1.Network.MAINNET
        ? {
            liquidatableAssets: JSON.parse(process.env.LIQUIDATABLE_ASSETS),
            liquidationFiltererAddress: process.env.LIQUIDATION_FILTERER_CONTRACT,
            safetyMargin: 0.05,
            chainName: "osmosis",
            lcdEndpoint: process.env.LCD_ENDPOINT,
            gasDenom: 'uosmo',
            hiveEndpoint: process.env.HIVE_ENDPOINT,
            liquidatorMasterAddress: liquidatorMasterAddress,
            logResults: false,
            neutralAssetDenom: 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858',
            oracleAddress: 'osmo1mhznfr60vjdp2gejhyv2gax9nvyyzhd3z0qcwseyetkfustjauzqycsy2g',
            redbankAddress: 'osmo1c3ljch9dfw5kf52nfwpxd2zmj2ese7agnx0p9tenkrryasrle5sqf3ftpg',
            redisEndpoint: process.env.REDIS_ENDPOINT,
            poolsRefreshWindow: 60000,
            astroportApi: "https://app.astroport.fi/api/",
        }
        : {
            liquidatableAssets: JSON.parse(process.env.LIQUIDATABLE_ASSETS),
            liquidationFiltererAddress: process.env.LIQUIDATION_FILTERER_CONTRACT,
            chainName: "osmosis",
            safetyMargin: 0.05,
            lcdEndpoint: process.env.LCD_ENDPOINT,
            gasDenom: 'uosmo',
            hiveEndpoint: process.env.HIVE_ENDPOINT,
            liquidatorMasterAddress: liquidatorMasterAddress,
            logResults: false,
            neutralAssetDenom: 'uosmo',
            oracleAddress: 'osmo1dqz2u3c8rs5e7w5fnchsr2mpzzsxew69wtdy0aq4jsd76w7upmsstqe0s8',
            redbankAddress: 'osmo1t0dl6r27phqetfu0geaxrng0u9zn8qgrdwztapt5xr32adtwptaq6vwg36',
            redisEndpoint: '',
            poolsRefreshWindow: 60000,
            astroportApi: "https://app.astroport.fi/api/",
        };
};
exports.getConfig = getConfig;
//# sourceMappingURL=osmosis.js.map