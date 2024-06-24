"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_mock_1 = __importDefault(require("fetch-mock"));
const OsmosisPoolProvider_1 = require("../../src/query/amm/OsmosisPoolProvider");
const Pool_1 = require("../../src/types/Pool");
describe('Osmosis Pool Provider', () => {
    afterEach(() => {
        fetch_mock_1.default.restore();
    });
    test('Parse all pools', async () => {
        const mockResponse = {
            pools: [
                {
                    "@type": "/osmosis.concentratedliquidity.v1beta1.Pool",
                    "address": "osmo19e2mf7cywkv7zaug6nk5f87d07fxrdgrladvymh2gwv5crvm3vnsuewhh7",
                    "incentives_address": "osmo156gncm3w2hdvuxxaejue8nejxgdgsrvdf7jftntuhxnaarhxcuas4ywjxf",
                    "spread_rewards_address": "osmo10t3u6ze74jn7et6rluuxyf9vr2arykewmhcx67svg6heuu0gte2syfudcv",
                    "id": "1",
                    "current_tick_liquidity": "2913542.129266224098563795",
                    "token0": "uosmo",
                    "token1": "usdc",
                    "current_sqrt_price": "1.000000000000000000",
                    "current_tick": "0",
                    "tick_spacing": "100",
                    "exponent_at_price_one": "-6",
                    "spread_factor": "0.001000000000000000",
                    "last_liquidity_update": "2023-06-05T06:27:33.361252Z"
                },
                {
                    "@type": "/osmosis.gamm.v1beta1.Pool",
                    "address": "osmo18ddcsq4jzf33x9f3vplv9779uvjq6ypx3en3wt9sd93njmas7ykst6z34u",
                    "id": "2",
                    "pool_params": {
                        "swap_fee": "0.002000000000000000",
                        "exit_fee": "0.000000000000000000",
                        "smooth_weight_change_params": null
                    },
                    "future_pool_governor": "24h",
                    "total_shares": {
                        "denom": "gamm/pool/2",
                        "amount": "100000000000000000000"
                    },
                    "pool_assets": [
                        {
                            "token": {
                                "denom": "uosmo",
                                "amount": "1000000"
                            },
                            "weight": "5368709120"
                        },
                        {
                            "token": {
                                "denom": "usdc",
                                "amount": "100000"
                            },
                            "weight": "5368709120"
                        }
                    ],
                    "total_weight": "10737418240"
                }
            ]
        };
        let lcdEndpoint = 'https://lcd.osmosis.zone';
        fetch_mock_1.default.mock('https://lcd.osmosis.zone/osmosis/poolmanager/v1beta1/all-pools', mockResponse);
        const poolProvider = new OsmosisPoolProvider_1.OsmosisPoolProvider(lcdEndpoint);
        const response = await poolProvider.loadPools();
        console.log(response);
        expect(response[0].poolType).toEqual(Pool_1.PoolType.CONCENTRATED_LIQUIDITY);
        expect(response[0].token0).toEqual('uosmo');
        expect(response[0].token1).toEqual('usdc');
        expect(response[1].poolType).toEqual(Pool_1.PoolType.XYK);
        expect(response[1].token0).toEqual('uosmo');
        expect(response[1].token1).toEqual('usdc');
    });
});
//# sourceMappingURL=osmosisPoolProvider.test.js.map