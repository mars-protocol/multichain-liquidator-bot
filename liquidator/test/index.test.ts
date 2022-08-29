
import {run} from '../index'
import jestConfig from '../jest.config'
import { createLiquidationTx } from '../liquidation_generator'
import { IRedisInterface, RedisInterface } from '../redis'
import { TxHelper } from '../tx_helpers'

describe('Testing Behaviour', () => {
    test(`We dont send liquidation When no addresses found`, async () => {
        
        const redis : IRedisInterface = {
            fetchUnhealthyAddresses : jest.fn(() => []),
            connect: jest.fn()
        }

        expect(redis.fetchUnhealthyAddresses().length).toBe(0)

        const txHelper : TxHelper = {
            produceLiquidationTx : jest.fn(),
            sendLiquidationTxs : jest.fn()
        }

        await run(txHelper, redis)
        //@ts-ignore
        expect(txHelper.produceLiquidationTx.mock.calls.length).toBe(0)
    })
})