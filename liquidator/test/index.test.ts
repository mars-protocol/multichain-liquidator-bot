import { run } from '../src/index'
import { IRedisInterface } from '../src/redis.js'
import { LiquidationHelper } from '../src/liquidation_helpers.js'
import { Position } from '../src/types/position'
import { RedisClientType } from '@redis/client'

describe('Testing Behaviour', () => {
  


    test(`We dont send liquidation When no addresses found`, async () => {

        const redis: IRedisInterface = {
            // @ts-ignore
            fetchUnhealthyPositions: jest.fn(async () => {
                return []
            }),

            connect: jest.fn(async ()=> {
              //@ts-ignore
              const result : RedisClientType = jest.fn()()
              return result
            }),

            incrementBy: jest.fn(async (_key: string, _value: number) => {
                return 0
            }),
        }

        //@ts-ignore who cares its a test :)
        const txHelper: LiquidationHelper = {
            //@ts-ignore
            produceLiquidationTx: jest.fn((_position: Position)=>jest.mock("LiquidationTx")),

            //@ts-ignore
            sendLiquidationsTx: jest.fn(),

            //@ts-ignore
            swap: jest.fn()
        }

    await run(txHelper, redis)

    //@ts-ignore
    expect(txHelper.produceLiquidationTx.mock.calls.length).toBe(0)
  })
})
