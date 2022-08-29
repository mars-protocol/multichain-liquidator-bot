// Create test
import RedisClient from '@redis/client/dist/lib/client'
import { RedisClientType } from 'redis'
import {RedisInterface} from '../redis'
import { Position } from '../types/position'
import {generateRandomPosition} from './test_helpers'

describe('Redis Tests', ()=> {
    test(`We can read position from redis`, async ()=> {
        const queueName = "test_queue"
        const redisInterface = new RedisInterface()
        const redisClient  = await redisInterface.connect() // not providing a param connects to localhost
        const position = generateRandomPosition()
        redisClient.rPush(queueName,JSON.stringify(position))
    })
})
