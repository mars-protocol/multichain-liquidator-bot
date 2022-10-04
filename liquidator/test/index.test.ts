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


    test(`We dont send liquidation When no addresses found`, async () => {

        const redis: IRedisInterface = {
            // @ts-ignore
            fetchUnhealthyPositions: jest.fn(async () => {
                return []
            }),
            connect: jest.fn(),
            // incrementBy: jest.fn(key: string, value: number): Promise<number> {
            //     return 0
            // }
            incrementBy: jest.fn(async (key: string, value: number) => {
                return 0
            }),
        }

        //@ts-ignore who cares its a test :)
        const txHelper: LiquidationHelper = {
            produceLiquidationTx: jest.fn(),
            sendLiquidationsTx: jest.fn(),
            swap: jest.fn()
        }

    await run(txHelper, redis)

    //@ts-ignore
    expect(txHelper.produceLiquidationTx.mock.calls.length).toBe(0)
  })
})
