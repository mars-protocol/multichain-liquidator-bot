"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("../src/redis");
const testHelpers_1 = require("./testHelpers");
describe('Redis Tests', () => {
    test(`We can connect to redis`, async () => {
        const redisInterface = new redis_1.RedisInterface();
        const redisClient = await redisInterface.connect();
        expect(redisClient.isReady).toBe(true);
    });
    test(`We can read position from redis`, async () => {
        const queueName = Math.random().toString();
        const redisInterface = new redis_1.RedisInterface(queueName);
        const redisClient = await redisInterface.connect();
        const position = (0, testHelpers_1.generateRandomPosition)();
        const position2 = (0, testHelpers_1.generateRandomPosition)();
        await redisClient.lPush(queueName, JSON.stringify(position));
        await redisClient.lPush(queueName, JSON.stringify(position2));
        const returnedPositions = await redisInterface.popUnhealthyPositions(25);
        expect(returnedPositions[1].Identifier).toBe(position.Identifier);
    });
});
//# sourceMappingURL=redis.test.js.map