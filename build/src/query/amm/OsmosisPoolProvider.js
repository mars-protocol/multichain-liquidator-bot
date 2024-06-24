"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OsmosisPoolProvider = void 0;
const unit_1 = require("@keplr-wallet/unit");
const helpers_1 = require("../../helpers");
const Pool_1 = require("../../types/Pool");
class OsmosisPoolProvider {
    constructor(lcdEndpoint) {
        this.lcdEndpoint = lcdEndpoint;
        this.loadPools = async () => {
            let fetched = false;
            let pools = [];
            let retryCount = 0;
            while (!fetched && retryCount < 5) {
                try {
                    const response = await fetch(`${this.lcdEndpoint}/osmosis/poolmanager/v1beta1/all-pools`);
                    const responseJson = await response.json();
                    pools = [];
                    responseJson.pools.forEach((data) => {
                        if (data['@type'] === '/osmosis.concentratedliquidity.v1beta1.Pool') {
                            const result = (0, helpers_1.camelCaseKeys)(data);
                            result.poolType = Pool_1.PoolType.CONCENTRATED_LIQUIDITY;
                            pools.push(result);
                        }
                        else if (data['@type'] === '/osmosis.gamm.v1beta1.Pool') {
                            const result = (0, helpers_1.camelCaseKeys)(data);
                            result.poolType = Pool_1.PoolType.XYK;
                            result.token0 = result.poolAssets[0].token.denom;
                            result.token1 = result.poolAssets[1].token.denom;
                            pools.push(result);
                        }
                        else {
                            console.log('unsupported pool type');
                        }
                    });
                    fetched = true;
                }
                catch {
                    retryCount++;
                    console.log('retrying fetch');
                }
            }
            await Promise.all(pools
                .filter(pool => pool.poolType === Pool_1.PoolType.CONCENTRATED_LIQUIDITY)
                .map(pool => this.fetchTickData(pool)));
            return pools;
        };
        this.fetchTickData = async (pool) => {
            const minTick = new unit_1.Int(-162000000);
            const maxTick = new unit_1.Int(342000000);
            const zeroToOneTicksUrl = `${this.lcdEndpoint}/osmosis/concentratedliquidity/v1beta1/liquidity_net_in_direction?pool_id=${pool.id}&token_in=${pool.token0}&use_cur_tick=true&bound_tick=${minTick.toString()}`;
            const oneToZeroTicksUrl = `${this.lcdEndpoint}/osmosis/concentratedliquidity/v1beta1/liquidity_net_in_direction?pool_id=${pool.id}&token_in=${pool.token1}&use_cur_tick=true&bound_tick=${maxTick.toString()}`;
            const zeroToOneTicks = await this.fetchDepths(zeroToOneTicksUrl);
            const oneToZeroTicks = await this.fetchDepths(oneToZeroTicksUrl);
            pool.liquidityDepths = {
                zeroToOne: zeroToOneTicks,
                oneToZero: oneToZeroTicks
            };
            return pool;
        };
        this.fetchDepths = async (url) => {
            const responseJson = await this.sendRequest(url);
            return responseJson.liquidity_depths.map((depth) => (0, helpers_1.camelCaseKeys)(depth));
        };
        this.sendRequest = async (url) => {
            const response = await fetch(url);
            return await response.json();
        };
    }
}
exports.OsmosisPoolProvider = OsmosisPoolProvider;
//# sourceMappingURL=OsmosisPoolProvider.js.map