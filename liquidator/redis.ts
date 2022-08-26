
import { commandOptions, RedisClientType } from '@redis/client';
import { createClient } from 'redis';

interface IRedisInterface {
    connect() : Promise<RedisClientType>
    fetchUnhealthyAddresses() : string[]
}


class RedisInterface implements IRedisInterface {

    LIQUIDATION_QUEUE_NAME : string = process.env.LIQUIDATION_QUEUE_NAME!

    // We use a singleton but expose the client via connect()
    private client : RedisClientType

    /**
     * Fetch all addresses out of UNHEALTHY_QUEUE redis list
     * 
     * Note that the max this can return at 1 time is 1000, any more will be left in 
     * the list
     */
    fetchUnhealthyAddresses(): string[] {

        this.client.lPop( this.LIQUIDATION_QUEUE_NAME)

        throw new Error("Method not implemented.");
    }

    /**
     * @param url The redis endpoint. Not pass this parameter defaults to localhost
     */
    async connect(url? : string): Promise<RedisClientType> {
        if (this.client) {
           // client already exists
           return this.client
        }

        this.client = url ? createClient({url}) : createClient();
        
        // todo logging
        this.client.on('error', (err) => console.error('Redis Client Error', err));
        await this.client.connect()

        return this.client  
    }

}