
import {run} from '../index'
import jestConfig from '../jest.config'
import { createLiquidationTx } from '../liquidation_generator'
import { IRedisInterface, RedisInterface } from '../redis'
import { LiquidationHelper } from '../liquidation_helpers'
import { Position } from '../types/position'

describe('Testing Behaviour', () => {

    
    test(`We dont send liquidation When no addresses found`, async () => {
        
        const redis : IRedisInterface = {
            // @ts-ignore
            fetchUnhealthyPositions : jest.fn(async() => {
                return []
            }),
            connect: jest.fn()
        }

        //@ts-ignore who cares its a test :)
        const txHelper : LiquidationHelper = {
            produceLiquidationTx : jest.fn(),
            sendLiquidationTxs : jest.fn(),
            swap: jest.fn()
        }

        await run(txHelper, redis)

        //@ts-ignore
        expect(txHelper.produceLiquidationTx.mock.calls.length).toBe(0)
    })
})