
import {run} from '../index'
import jestConfig from '../jest.config'
import { createLiquidationTx } from '../liquidation_generator'
import { IRedisInterface, RedisInterface } from '../redis'
import { TxHelper } from '../tx_helpers'
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
        
        const txHelper : TxHelper = {
            produceLiquidationTx : jest.fn(),
            sendLiquidationTxs : jest.fn(),
            swapCollateralClaimed: jest.fn()
        }

        await run(txHelper, redis)

        //@ts-ignore
        expect(txHelper.produceLiquidationTx.mock.calls.length).toBe(0)
    })
})