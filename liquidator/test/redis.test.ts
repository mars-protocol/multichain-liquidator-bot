// Create test
import RedisClient from '@redis/client/dist/lib/client'
import { RedisClientType } from 'redis'
import {RedisInterface} from '../redis'
import { Position } from '../types/position'
import {generateRandomPosition} from './test_helpers'


describe('Redis Tests', ()=> {

    test(`We can connect to redis`, async () => {
        const queueName = "test_queue"
        const redisInterface = new RedisInterface()
        const redisClient  = await redisInterface.connect()
        expect(redisClient.isReady).toBe(true)
    })

    test(`We can read position from redis`, async ()=> {
        const queueName = Math.random().toString()

        const redisInterface = new RedisInterface(queueName)
        const redisClient  = await redisInterface.connect() // not providing a param connects to localhost
        const position = generateRandomPosition()
        const position2 = generateRandomPosition()
        await redisClient.lPush(queueName, JSON.stringify(position))
        await redisClient.lPush(queueName, JSON.stringify(position2))

        const returnedPositions = await redisInterface.fetchUnhealthyPositions()
        // // first in last out - so index is 1
        expect(returnedPositions[1].address).toBe(position.address)
    })
})
