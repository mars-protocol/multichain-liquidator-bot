import { run } from '../src/index'
import { createLiquidationTx } from '../src/liquidation_generator'
import { IRedisInterface, RedisInterface } from '../src/redis'
import { LiquidationHelper } from '../src/liquidation_helpers.js'

describe('Testing Behaviour', () => {
  test(`We dont send liquidation When no addresses found`, async () => {
    const redis: IRedisInterface = {
      // @ts-ignore
      fetchUnhealthyPositions: jest.fn(async () => {
        return []
      }),
      connect: jest.fn(),
    }

    //@ts-ignore who cares its a test :)
    const txHelper: LiquidationHelper = {
      produceLiquidationTx: jest.fn(),
      sendLiquidationTxs: jest.fn(),
      swap: jest.fn(),
    }

    await run(txHelper, redis)

    //@ts-ignore
    expect(txHelper.produceLiquidationTx.mock.calls.length).toBe(0)
  })
})
