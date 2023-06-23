import { AMMRouter } from '../src/AmmRouter'
import { ConcentratedLiquidityPool, PoolAsset, PoolType, XYKPool } from '../src/types/Pool'
import Long from 'long'
import BigNumber from 'bignumber.js'
import { Dec, Int } from '@keplr-wallet/unit'
import { LiquidityDepth } from '../src/amm/osmosis/math/concentrated'

const generateRandomPoolAsset = (
	denom: string = Math.random().toString(),
	amount: string = Math.random().toString(),
): PoolAsset => {
	return {
		token: {
			denom: denom,
			amount: amount,
		},
	}
}

const generateRandomXykPool = (poolAssets?: PoolAsset[]): XYKPool => {
	if (!poolAssets) poolAssets = [generateRandomPoolAsset(), generateRandomPoolAsset()]

	// We need to test scenarios where the tokenIn is either token0 or token1. 
	// To do this we generate the token index as either 0 or 1, and then use the other index for token out
	const tokenInIndex = Math.floor(Math.random() * 2)
	const tokenOutIndex = tokenInIndex === 1 ? 0 : 1
	const pool: XYKPool = {
		address: 'osmo1j4xmzkea5t8s077t0s39vs5psp6f6dacpjswn64ln2v4pncwxg3qjs30zl',
		id: (Math.random() * 10000000) as unknown as Long,
		swapFee: '0.002',
		poolType: PoolType.XYK,
		token0: poolAssets[tokenInIndex].token.denom,
		token1: poolAssets[tokenOutIndex].token.denom,
		poolAssets: poolAssets!,
	}
	return pool
}

const generateLiquidityDepths = (): LiquidityDepth[] => {
	const inittedTicks = [
		{
		  tickIndex: new Int(305450),
		  netLiquidity: new Dec("1517882343.751510418088349649"),
		},
		{
		  tickIndex: new Int(315000),
		  netLiquidity: new Dec("-1517882343.751510418088349649"),
		},
	  ];

	  return inittedTicks
}


const generateRandomCLPool = (
		denomIn: string, 
		denomOut: string, 
		zeroToOne : LiquidityDepth[], 
		oneToZero: LiquidityDepth[],
		poolLiquidity: Dec,
		curSqrtPrice: Dec
	): ConcentratedLiquidityPool => {

	return {
		address: 'osmo1j4xmzkea5t8s077t0s39vs5psp6f6dacpjswn64ln2v4pncwxg3qjs30zl',
		id: (Math.random() * 10000000) as unknown as Long,
		swapFee: '0.002',
		poolType: PoolType.CONCENTRATED_LIQUIDITY,
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
	}


}

describe('Osmosis Router Tests', () => {
	test('We can find route with immediate pair', () => {
		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const pools = [
			generateRandomXykPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
			generateRandomXykPool(),
			generateRandomXykPool(),
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const routes = router.getRoutes(osmoDenom, atomDenom)

		expect(routes.length).toBe(1)
	})

	test('We can find two hop route with xyx pools', () => {
		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const stableDenom = 'stable'
		const pools = [
			generateRandomXykPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
			generateRandomXykPool([
				generateRandomPoolAsset(atomDenom),
				generateRandomPoolAsset(stableDenom),
			]),
			generateRandomXykPool(),
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const routes = router.getRoutes(osmoDenom, stableDenom)

		expect(routes.length).toBe(1)
		expect(routes[0].length).toBe(2)
		expect(routes[0][0].tokenInDenom === osmoDenom)
		expect(routes[0][0].tokenOutDenom === atomDenom)
		expect(routes[0][1].tokenInDenom === atomDenom)
		expect(routes[0][1].tokenOutDenom === stableDenom)
	})

	test('We can find two hop route with cl pools', () => {
		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const stableDenom = 'stable'
		const poolLiquidity = new Dec("1517882343.751510418088349649")
		// found by printing liquidity net values to console with go test
		
		const curSqrtPrice = new Dec("70.710678118654752440")

		const poola = generateRandomCLPool(osmoDenom, atomDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice)
		const poolb = generateRandomCLPool(atomDenom, stableDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice)

		const pools = [
			poola,
			poolb
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const routes = router.getRoutes(osmoDenom, stableDenom)

		expect(routes.length).toBe(1)
		expect(routes[0].length).toBe(2)
		expect(routes[0][0].tokenInDenom === osmoDenom)
		expect(routes[0][0].tokenOutDenom === atomDenom)
		expect(routes[0][1].tokenInDenom === atomDenom)
		expect(routes[0][1].tokenOutDenom === stableDenom)
	})

	test('We can find the two separate routes', () => {
		// routea = "osmo:atom:stable"
		// routeb = "osmo:shit:stable"

		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const shitDenom = 'shit'
		const stableDenom = 'stable'
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
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const routes = router.getRoutes(osmoDenom, stableDenom)

		expect(routes.length).toBe(2)
		expect(routes[0].length).toBe(2)
		expect(routes[0][0].tokenInDenom === osmoDenom)
		expect(routes[0][0].tokenOutDenom === atomDenom)
		expect(routes[0][1].tokenInDenom === atomDenom)
		expect(routes[0][1].tokenOutDenom === stableDenom)

		expect(routes[1][0].tokenInDenom === osmoDenom)
		expect(routes[1][0].tokenOutDenom === stableDenom)
		expect(routes[1][1].tokenInDenom === stableDenom)
		expect(routes[1][1].tokenOutDenom === stableDenom)

		expect(routes[1].length).toBe(2)
	})

	test('We can find deep route', () => {
		// routea = "osmo:atom:shit:shit2:stable"

		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const shitDenom = 'shit'
		const hex = 'hex'
		const stableDenom = 'stable'
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
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const routes = router.getRoutes(osmoDenom, stableDenom)

		expect(routes.length).toBe(1)
		expect(routes[0].length).toBe(4)
		expect(routes)
	})

	test('We find multiple routes when depth of both routes is > 1', () => {
		// routea = "osmo:atom:shit:shit2:stable"
		// routeb = "osmo:atom:stable"
		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const shitDenom = 'shit'
		const hex = 'hex'
		const stableDenom = 'stable'
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
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const routes = router.getRoutes(osmoDenom, stableDenom)

		expect(routes.length).toBe(2)
	})

	test('We find cheapest route', () => {
		// routea = "osmo:shit:stable"
		// routeb = "osmo:atom:stable"
		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const shitDenom = 'hex'
		const stableDenom = 'stable'
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
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const routes = router.getRoutes(osmoDenom, stableDenom)

		expect(routes.length).toBe(2)

		const route1Cost = router.getOutput(new BigNumber(1), routes[0])
		const route2cost = router.getOutput(new BigNumber(1), routes[1])

		// our first route should have better pricing
		expect(route1Cost.toNumber()).toBeGreaterThan(route2cost.toNumber())
	})

	test('We find highest output to CL pool', () => {
		// routea = "osmo:atom:stable		osmo->atom (xyk) atom -> stable(xyk)
		// routeb = "osmo:atom(cl):stable - osmo->atom (xyk) atom->stable(cl)
		// just make the price really bad on the second amm pool

		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const stableDenom = 'stable'

		const poolLiquidity = new Dec("1517882343.751510418088349649");
		
		// price needs to be higher than the current
		const curSqrtPrice = new Dec("1.0610678118654752440");

		const pool = generateRandomCLPool(atomDenom, stableDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice)

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
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const routes = router.getRoutes(osmoDenom, stableDenom)

		expect(routes.length).toBe(2)

		const route1Output = router.getOutput(new BigNumber(100), routes[0])
		const route2Output = router.getOutput(new BigNumber(100), routes[1])

		// ensure second route contains cl pool
		expect(routes[1][1].pool.poolType).toBe(PoolType.CONCENTRATED_LIQUIDITY)

		// our second route should have better pricing
		expect(route1Output.toNumber()).toBeLessThan(route2Output.toNumber())
	})

	test('We find lowest input to CL pool', () => {
		// routea = "osmo:atom:stable		osmo->atom (xyk) atom -> stable(xyk)
		// routeb = "osmo:atom(cl):stable - osmo->atom (xyk) atom->stable(cl)
		// just make the price really bad on the second amm pool

		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const stableDenom = 'stable'

		const poolLiquidity = new Dec("1517882343.751510418088349649");
		
		// price needs to be higher than the 100
		const curSqrtPrice = new Dec("1.2610678118654752440");

		const pool = generateRandomCLPool(atomDenom, stableDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice)
		

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
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const routes = router.getRoutes(osmoDenom, stableDenom)

		expect(routes.length).toBe(2)

		const route1Input = router.getRequiredInput(new BigNumber(5), routes[0])
		const route2Input = router.getRequiredInput(new BigNumber(5), routes[1])

		// ensure second route contains cl pool
		expect(routes[1][1].pool.poolType).toBe(PoolType.CONCENTRATED_LIQUIDITY)

		// our second route should have better pricing
		expect(route1Input.toNumber()).toBeGreaterThan(route2Input.toNumber())
	})

	test('We find get best route to CL pool', () => {
		// routea = "osmo:atom:stable		osmo->atom (xyk) atom -> stable(xyk)
		// routeb = "osmo:atom(cl):stable - osmo->atom (xyk) atom->stable(cl)
		// just make the price really bad on the second amm pool

		const osmoDenom = 'osmo'
		const atomDenom = 'atom'
		const stableDenom = 'stable'

		const poolLiquidity = new Dec("1517882343.751510418088349649");
		
		// price needs to be higher than the 100
		const curSqrtPrice = new Dec("1.0610678118654752440");

		const pool = generateRandomCLPool(atomDenom, stableDenom, generateLiquidityDepths(), generateLiquidityDepths(), poolLiquidity, curSqrtPrice)
		

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
		]

		const router = new AMMRouter()
		router.setPools(pools)

		const bestRouteInput = router.getBestRouteGivenInput(osmoDenom, stableDenom, new BigNumber(3))
		const bestRouteOutput = router.getBestRouteGivenOutput(osmoDenom, stableDenom, new BigNumber(3))

		expect(bestRouteInput[0].poolId).toBe(bestRouteOutput[0].poolId)
		expect(bestRouteInput[1].poolId).toBe(bestRouteOutput[1].poolId)
		expect(bestRouteInput[0].pool.poolType).toBe(bestRouteOutput[0].pool.poolType)
		expect(bestRouteInput[1].pool.poolType).toBe(bestRouteOutput[1].pool.poolType)
		expect(bestRouteInput[1].pool.poolType).toBe(PoolType.CONCENTRATED_LIQUIDITY)
		expect(bestRouteOutput[1].pool.poolType).toBe(PoolType.CONCENTRATED_LIQUIDITY)
	})
})
