"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = void 0;
const osmosis_1 = require("./osmosis");
const neutron_1 = require("./neutron");
const getConfig = (liquidatorAddress, network, chainName) => {
    switch (chainName) {
        case "osmosis":
            return (0, osmosis_1.getConfig)(liquidatorAddress, network);
        case "neutron":
            return (0, neutron_1.getConfig)(liquidatorAddress, network);
        default:
            throw new Error(`Invalid chain name. Chain name must be either osmosis or neutron, recieved ${chainName}`);
    }
};
exports.getConfig = getConfig;
//# sourceMappingURL=getConfig.js.map