"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisInterface = void 0;
const redis_1 = require("redis");
class RedisInterface {
    constructor(key) {
        this.key = process.env.LIQUIDATION_QUEUE_NAME
            ? process.env.LIQUIDATION_QUEUE_NAME
            : key
                ? key
                : 'testing-queue';
    }
    async popUnhealthyPositions(count) {
        if (!this.client) {
            console.log(`ERROR: redis client not connected`);
            return [];
        }
        const result = await this.client.lPopCount(this.key, count);
        if (!result)
            return [];
        return result?.map((positionString) => JSON.parse(positionString));
    }
    async incrementBy(key, value) {
        if (!this.client) {
            console.log(`ERROR: redis client not connected`);
            return 0;
        }
        return await this.client.incrBy(key, value);
    }
    async connect(url) {
        if (this.client) {
            return this.client;
        }
        this.client = url ? (0, redis_1.createClient)({ url }) : (0, redis_1.createClient)();
        this.client.on('error', (err) => console.error('Redis Client Error', err));
        await this.client.connect();
        return this.client;
    }
}
exports.RedisInterface = RedisInterface;
//# sourceMappingURL=redis.js.map