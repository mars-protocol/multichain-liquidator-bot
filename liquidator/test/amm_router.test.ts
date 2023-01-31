import { AMMRouter } from '../src/amm_router'
import { Coin } from '@cosmjs/amino'
import { Pool } from '../src/types/Pool'
import Long from 'long'
import BigNumber from 'bignumber.js'

const generateRandomPoolAsset = (
  denom: string = Math.random().toString(),
  amount: string = Math.random().toString(),
): Coin => {
  return {
    denom: denom,
    amount: amount,
  }
}

const generateRandomPool = (poolAssets?: Coin[]): Pool => {
  if (!poolAssets) poolAssets = [generateRandomPoolAsset(), generateRandomPoolAsset()]
  const pool: Pool = {
    address: 'osmo1j4xmzkea5t8s077t0s39vs5psp6f6dacpjswn64ln2v4pncwxg3qjs30zl',
    id: (Math.random() * 10000000) as unknown as Long,
    swapFee: '0.002',
    poolAssets: poolAssets,
  }
  return pool
}

describe('Osmosis Router Tests', () => {
  test('We can find route with immediate pair', () => {
    const osmoDenom = 'osmo'
    const atomDenom = 'atom'
    const pools = [
      generateRandomPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
      generateRandomPool(),
      generateRandomPool(),
    ]

    const router = new AMMRouter()
    router.setPools(pools)

    const routes = router.getRoutes(osmoDenom, atomDenom)

    expect(routes.length).toBe(1)
  })

  test('We can find two hop route', () => {
    const osmoDenom = 'osmo'
    const atomDenom = 'atom'
    const stableDenom = 'stable'
    const pools = [
      generateRandomPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
      generateRandomPool([
        generateRandomPoolAsset(atomDenom),
        generateRandomPoolAsset(stableDenom),
      ]),
      generateRandomPool(),
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
      generateRandomPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
      generateRandomPool(),
      generateRandomPool([
        generateRandomPoolAsset(atomDenom),
        generateRandomPoolAsset(stableDenom),
      ]),
      generateRandomPool(),
      generateRandomPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(shitDenom)]),
      generateRandomPool(),
      generateRandomPool([
        generateRandomPoolAsset(shitDenom),
        generateRandomPoolAsset(stableDenom),
      ]),
      generateRandomPool(),
      generateRandomPool(),
      generateRandomPool(),
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
      generateRandomPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
      generateRandomPool(),
      generateRandomPool([generateRandomPoolAsset(atomDenom), generateRandomPoolAsset(shitDenom)]),
      generateRandomPool(),
      generateRandomPool([generateRandomPoolAsset(shitDenom), generateRandomPoolAsset(hex)]),
      generateRandomPool(),
      generateRandomPool([generateRandomPoolAsset(hex), generateRandomPoolAsset(stableDenom)]),
      generateRandomPool(),
      generateRandomPool(),
      generateRandomPool(),
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
      generateRandomPool([generateRandomPoolAsset(osmoDenom), generateRandomPoolAsset(atomDenom)]),
      generateRandomPool(),
      generateRandomPool([generateRandomPoolAsset(atomDenom), generateRandomPoolAsset(shitDenom)]),
      generateRandomPool(),
      generateRandomPool([generateRandomPoolAsset(shitDenom), generateRandomPoolAsset(hex)]),
      generateRandomPool(),
      generateRandomPool([generateRandomPoolAsset(hex), generateRandomPoolAsset(stableDenom)]),
      generateRandomPool(),
      generateRandomPool(),
      generateRandomPool([
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
    const shitDenom = 'shit'
    const hex = 'hex'
    const stableDenom = 'stable'
    const pools = [
      generateRandomPool([
        generateRandomPoolAsset(osmoDenom, '100'),
        generateRandomPoolAsset(atomDenom, '100'),
      ]),
      generateRandomPool(),
      generateRandomPool(),
      generateRandomPool([
        generateRandomPoolAsset(shitDenom, '100'),
        generateRandomPoolAsset(osmoDenom, '101'),
      ]),
      generateRandomPool(),
      generateRandomPool([
        generateRandomPoolAsset(shitDenom, '100'),
        generateRandomPoolAsset(stableDenom, '100'),
      ]),
      generateRandomPool(),
      generateRandomPool(),
      generateRandomPool([
        generateRandomPoolAsset(atomDenom, '100'),
        generateRandomPoolAsset(stableDenom, '100'),
      ]),
    ]

    const router = new AMMRouter()
    router.setPools(pools)

    const routes = router.getRoutes(osmoDenom, stableDenom)

    expect(routes.length).toBe(2)

    const route1Cost = router.getEstimatedOutput(new BigNumber(1), routes[0])
    const route2cost = router.getEstimatedOutput(new BigNumber(1), routes[1])

    // our first route should have better pricing
    expect(route1Cost.toNumber()).toBeGreaterThan(route2cost.toNumber())
  })

  // test we can correctly identify cheapest route

  // test we correctly identify longer route when cheaper
})
