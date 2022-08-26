// set up tests

require('../../index.js')

describe('Testing Behaviour', () => {
    test(`We dont send liquidation When no addresses found`, () => {
        const redis = {
            fetchUnhealthyAddresses: jest.fn(() => [])
        }
        expect(redis.fetchUnhealthyAddresses().length).toBe(0)

        const txHelper = {
            produceLiquidationTx : jest.fn()
        }
        
        index.run(txHelper, redis)
        
        expect(txHelper.produceLiquidationTx.mock.calls.length).toBe(0)
    })
})