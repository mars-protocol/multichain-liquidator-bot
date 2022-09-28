import { commandOptions, RedisClientType } from '@redis/client'
import { createClient } from 'redis'
import { Position } from './types/position'

export interface IRedisInterface {
  connect(): Promise<RedisClientType>
  fetchUnhealthyPositions(): Promise<Position[]>
  incrementBy(key: string, value: number): Promise<number>
}

export class RedisInterface implements IRedisInterface {
  // We use a singleton but expose the client via connect()
  private client: RedisClientType | undefined
  private key: string

  /**
   *
   * @param key the key to the liquidation redis list. Not passing a key and
   * setting via the .env file is preferred for production.
   */
  constructor(key?: string) {
    this.key = !key ? process.env.LIQUIDATION_QUEUE_NAME! : key
  }

  /**
   * Fetch all addresses out of UNHEALTHY_QUEUE redis list
   *
   * Note that the max this can return at 1 time is 1000, any more will be left in
   * the list
   */
  async fetchUnhealthyPositions(): Promise<Position[]> {
    if (!this.client) {
      console.log(`ERROR: redis client not connected`)
      return []
    }

    const result = await this.client.lPopCount(this.key, 100)

    // Ignoring the Type error here because type is inferred to caller by the method signature
    // @ts-ignore
    return result?.map((positionString: string) => JSON.parse(positionString))
  }

  /**
   * Increment the value at key by value
   * @param key The key to increment
   * @param value The value to increment by
   */
  async incrementBy(key: string, value: number): Promise<number> {
    // const result = await this.client.incrementBy(key, value)
    // return parseInt(result)
    return 1
  }

  /**
   * @param url The redis endpoint. Not pass this parameter defaults to localhost
   */
  async connect(url?: string): Promise<RedisClientType> {
    if (this.client) {
      // client already exists
      return this.client
    }

    this.client = url ? createClient({ url }) : createClient()

    // todo logging
    this.client.on('error', (err) => console.error('Redis Client Error', err))
    await this.client.connect()

    return this.client
  }
}
