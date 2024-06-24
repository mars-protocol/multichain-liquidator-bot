"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AmmRouter_1 = require("../src/AmmRouter");
const Pool_1 = require("../src/types/Pool");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const unit_1 = require("@keplr-wallet/unit");
const generateRandomPoolAsset = (denom = Math.random().toString(), amount = Math.random().toString()) => {
    return {
        token: {
            denom: denom,
            amount: amount,
        },
    };
};
const generateRandomXykPool = (poolAssets) => {
    if (!poolAssets)
        poolAssets = [generateRandomPoolAsset(), generateRandomPoolAsset()];
    const tokenInIndex = Math.floor(Math.random() * 2);
    const tokenOutIndex = tokenInIndex === 1 ? 0 : 1;
    const pool = {
        address: 'osmo1j4xmzkea5t8s077t0s39vs5psp6f6dacpjswn64ln2v4pncwxg3qjs30zl',
        id: (Math.random() * 10000000),
        swapFee: '0.002',
        poolType: Pool_1.PoolType.XYK,
        token0: poolAssets[tokenInIndex].token.denom,
        token1: poolAssets[tokenOutIndex].token.denom,
        poolAssets: poolAssets,
    };
    return pool;
};
const generateLiquidityDepths = () => {
    const inittedTicks = [
        {
            tickIndex: new unit_1.Int(305450),
            netLiquidity: new unit_1.Dec("1517882343.751510418088349649"),
        },
        {
            tickIndex: new unit_1.Int(315000),
            netLiquidity: new unit_1.Dec("-1517882343.751510418088349649"),
        },
    ];
    return inittedTicks;
};
const generateRandomCLPool = (denomIn, denomOut, zeroToOne, oneToZero, poolLiquidity, curSqrtPrice) => {
    return {
        address: 'osmo1j4xmzkea5t8s077t0s39vs5psp6f6dacpjswn64ln2v4pncwxg3qjs30zl',
        id: (Math.random() * 10000000),
        swapFee: '0.002',
        poolType: Pool_1.PoolType.CONCENTRATED_LIQUIDITY,
        token0: denomIn,
        token1: denomOut,
        incentivesAddress: 'osmo1j4xmzkea5t8s077t0s39vs5psp6f6dacpjswn64ln2v4pncwxg3qjs30zl',
        spreadRewardsAddress: 'osmo1j4xmzkea5t8s077t0s39vs5psp6f6dacpjswn64ln2v4pncwxg3qjs30zl',
        currentTickLiquidity: poolLiquidity.toString(),
        currentSqrtPrice: curSqrtPrice.toString(),
        currentTick: '0',
        tickSpacing: '1',
        exponentAtPriceOne: '1',
        spreadFactor: '1',
        lastLiquidityUpdate: '0',
        liquidityDepths: {
            oneToZero,
            zeroToOne
        }
    };
};
describe('Osmosis Router Tests', () => {
    test('We can find route with immediate pair', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const pools = [
            generateRandomXykPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
            generateRandomXykPool(),
            generateRandomXykPool(),
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const routes = router.getRoutes(osmoDenom, atomDenom);
        expect(routes.length).toBe(1);
    });
    test('We can find two hop route with xyx pools', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const stableDenom = 'stable';
        const pools = [
            generateRandomXykPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
            generateRandomXykPool([
                generateRandomPoolAsset(atomDenom),
                generateRandomPoolAsset(stableDenom),
            ]),
            generateRandomXykPool(),
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const routes = router.getRoutes(osmoDenom, stableDenom);
        expect(routes.length).toBe(1);
        expect(routes[0].length).toBe(2);
        expect(routes[0][0].tokenInDenom === osmoDenom);
        expect(routes[0][0].tokenOutDenom === atomDenom);
        expect(routes[0][1].tokenInDenom === atomDenom);
        expect(routes[0][1].tokenOutDenom === stableDenom);
    });
    test('We can find two hop route with cl pools', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const stableDenom = 'stable';
        const poolLiquidity = new unit_1.Dec("1517882343.751510418088349649");
        const curSqrtPrice = new unit_1.Dec("70.710678118654752440");
        const poola = generateRandomCLPool(osmoDenom, atomDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice);
        const poolb = generateRandomCLPool(atomDenom, stableDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice);
        const pools = [
            poola,
            poolb
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const routes = router.getRoutes(osmoDenom, stableDenom);
        expect(routes.length).toBe(1);
        expect(routes[0].length).toBe(2);
        expect(routes[0][0].tokenInDenom === osmoDenom);
        expect(routes[0][0].tokenOutDenom === atomDenom);
        expect(routes[0][1].tokenInDenom === atomDenom);
        expect(routes[0][1].tokenOutDenom === stableDenom);
    });
    test('We can find the two separate routes', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const shitDenom = 'shit';
        const stableDenom = 'stable';
        const pools = [
            generateRandomXykPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
            generateRandomXykPool(),
            generateRandomXykPool([
                generateRandomPoolAsset(atomDenom),
                generateRandomPoolAsset(stableDenom),
            ]),
            generateRandomXykPool(),
            generateRandomXykPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(shitDenom)]),
            generateRandomXykPool(),
            generateRandomXykPool([
                generateRandomPoolAsset(shitDenom),
                generateRandomPoolAsset(stableDenom),
            ]),
            generateRandomXykPool(),
            generateRandomXykPool(),
            generateRandomXykPool(),
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const routes = router.getRoutes(osmoDenom, stableDenom);
        expect(routes.length).toBe(2);
        expect(routes[0].length).toBe(2);
        expect(routes[0][0].tokenInDenom === osmoDenom);
        expect(routes[0][0].tokenOutDenom === atomDenom);
        expect(routes[0][1].tokenInDenom === atomDenom);
        expect(routes[0][1].tokenOutDenom === stableDenom);
        expect(routes[1][0].tokenInDenom === osmoDenom);
        expect(routes[1][0].tokenOutDenom === stableDenom);
        expect(routes[1][1].tokenInDenom === stableDenom);
        expect(routes[1][1].tokenOutDenom === stableDenom);
        expect(routes[1].length).toBe(2);
    });
    test('We can find deep route', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const shitDenom = 'shit';
        const hex = 'hex';
        const stableDenom = 'stable';
        const pools = [
            generateRandomXykPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
            generateRandomXykPool(),
            generateRandomXykPool([generateRandomPoolAsset(atomDenom), generateRandomPoolAsset(shitDenom)]),
            generateRandomXykPool(),
            generateRandomXykPool([generateRandomPoolAsset(shitDenom), generateRandomPoolAsset(hex)]),
            generateRandomXykPool(),
            generateRandomXykPool([generateRandomPoolAsset(hex), generateRandomPoolAsset(stableDenom)]),
            generateRandomXykPool(),
            generateRandomXykPool(),
            generateRandomXykPool(),
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const routes = router.getRoutes(osmoDenom, stableDenom);
        expect(routes.length).toBe(1);
        expect(routes[0].length).toBe(4);
        expect(routes);
    });
    test('We find multiple routes when depth of both routes is > 1', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const shitDenom = 'shit';
        const hex = 'hex';
        const stableDenom = 'stable';
        const pools = [
            generateRandomXykPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
            generateRandomXykPool(),
            generateRandomXykPool([generateRandomPoolAsset(atomDenom), generateRandomPoolAsset(shitDenom)]),
            generateRandomXykPool(),
            generateRandomXykPool([generateRandomPoolAsset(shitDenom), generateRandomPoolAsset(hex)]),
            generateRandomXykPool(),
            generateRandomXykPool([generateRandomPoolAsset(hex), generateRandomPoolAsset(stableDenom)]),
            generateRandomXykPool(),
            generateRandomXykPool(),
            generateRandomXykPool([
                generateRandomPoolAsset(atomDenom),
                generateRandomPoolAsset(stableDenom),
            ]),
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const routes = router.getRoutes(osmoDenom, stableDenom);
        expect(routes.length).toBe(2);
    });
    test('We find cheapest route', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const shitDenom = 'hex';
        const stableDenom = 'stable';
        const pools = [
            generateRandomXykPool([
                generateRandomPoolAsset(osmoDenom, '100'),
                generateRandomPoolAsset(atomDenom, '100'),
            ]),
            generateRandomXykPool(),
            generateRandomXykPool(),
            generateRandomXykPool([
                generateRandomPoolAsset(shitDenom, '100'),
                generateRandomPoolAsset(osmoDenom, '101'),
            ]),
            generateRandomXykPool(),
            generateRandomXykPool([
                generateRandomPoolAsset(shitDenom, '100'),
                generateRandomPoolAsset(stableDenom, '100'),
            ]),
            generateRandomXykPool(),
            generateRandomXykPool(),
            generateRandomXykPool([
                generateRandomPoolAsset(atomDenom, '100'),
                generateRandomPoolAsset(stableDenom, '100'),
            ]),
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const routes = router.getRoutes(osmoDenom, stableDenom);
        expect(routes.length).toBe(2);
        const route1Cost = router.getOutput(new bignumber_js_1.default(1), routes[0]);
        const route2cost = router.getOutput(new bignumber_js_1.default(1), routes[1]);
        expect(route1Cost.toNumber()).toBeGreaterThan(route2cost.toNumber());
    });
    test('We find highest output to CL pool', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const stableDenom = 'stable';
        const poolLiquidity = new unit_1.Dec("1517882343.751510418088349649");
        const curSqrtPrice = new unit_1.Dec("1.0610678118654752440");
        const pool = generateRandomCLPool(atomDenom, stableDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice);
        const pools = [
            generateRandomXykPool([
                generateRandomPoolAsset(osmoDenom, '100'),
                generateRandomPoolAsset(atomDenom, '100'),
            ]),
            generateRandomXykPool([
                generateRandomPoolAsset(atomDenom, '100'),
                generateRandomPoolAsset(stableDenom, '99'),
            ]),
            pool
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const routes = router.getRoutes(osmoDenom, stableDenom);
        expect(routes.length).toBe(2);
        const route1Output = router.getOutput(new bignumber_js_1.default(100), routes[0]);
        const route2Output = router.getOutput(new bignumber_js_1.default(100), routes[1]);
        expect(routes[1][1].pool.poolType).toBe(Pool_1.PoolType.CONCENTRATED_LIQUIDITY);
        expect(route1Output.toNumber()).toBeLessThan(route2Output.toNumber());
    });
    test('We find lowest input to CL pool', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const stableDenom = 'stable';
        const poolLiquidity = new unit_1.Dec("1517882343.751510418088349649");
        const curSqrtPrice = new unit_1.Dec("1.2610678118654752440");
        const pool = generateRandomCLPool(atomDenom, stableDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice);
        const pools = [
            generateRandomXykPool([
                generateRandomPoolAsset(osmoDenom, '100'),
                generateRandomPoolAsset(atomDenom, '100'),
            ]),
            generateRandomXykPool([
                generateRandomPoolAsset(atomDenom, '100'),
                generateRandomPoolAsset(stableDenom, '99'),
            ]),
            pool
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const routes = router.getRoutes(osmoDenom, stableDenom);
        expect(routes.length).toBe(2);
        const route1Input = router.getRequiredInput(new bignumber_js_1.default(5), routes[0]);
        const route2Input = router.getRequiredInput(new bignumber_js_1.default(5), routes[1]);
        expect(routes[1][1].pool.poolType).toBe(Pool_1.PoolType.CONCENTRATED_LIQUIDITY);
        expect(route1Input.toNumber()).toBeGreaterThan(route2Input.toNumber());
    });
    test('We find get best route to CL pool', () => {
        const osmoDenom = 'osmo';
        const atomDenom = 'atom';
        const stableDenom = 'stable';
        const poolLiquidity = new unit_1.Dec("1517882343.751510418088349649");
        const curSqrtPrice = new unit_1.Dec("1.0610678118654752440");
        const pool = generateRandomCLPool(atomDenom, stableDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice);
        const pools = [
            generateRandomXykPool([
                generateRandomPoolAsset(osmoDenom, '100'),
                generateRandomPoolAsset(atomDenom, '100'),
            ]),
            generateRandomXykPool([
                generateRandomPoolAsset(atomDenom, '100'),
                generateRandomPoolAsset(stableDenom, '99'),
            ]),
            pool
        ];
        const router = new AmmRouter_1.AMMRouter();
        router.setPools(pools);
        const bestRouteInput = router.getBestRouteGivenInput(osmoDenom, stableDenom, new bignumber_js_1.default(3));
        const bestRouteOutput = router.getBestRouteGivenOutput(osmoDenom, stableDenom, new bignumber_js_1.default(3));
        expect(bestRouteInput[0].poolId).toBe(bestRouteOutput[0].poolId);
        expect(bestRouteInput[1].poolId).toBe(bestRouteOutput[1].poolId);
        expect(bestRouteInput[0].pool.poolType).toBe(bestRouteOutput[0].pool.poolType);
        expect(bestRouteInput[1].pool.poolType).toBe(bestRouteOutput[1].pool.poolType);
        expect(bestRouteInput[1].pool.poolType).toBe(Pool_1.PoolType.CONCENTRATED_LIQUIDITY);
        expect(bestRouteOutput[1].pool.poolType).toBe(Pool_1.PoolType.CONCENTRATED_LIQUIDITY);
    });
});
//# sourceMappingURL=ammRouter.test.js.map