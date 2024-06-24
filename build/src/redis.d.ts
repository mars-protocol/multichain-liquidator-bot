import { RedisClientType } from '@redis/client';
export interface IRedisInterface {
    connect(): Promise<RedisClientType>;
    popUnhealthyPositions<T>(count: number): Promise<T[]>;
    incrementBy(key: string, value: number): Promise<number>;
}
export declare class RedisInterface implements IRedisInterface {
    private client;
    private key;
    constructor(key?: string);
    popUnhealthyPositions<T>(count: number): Promise<T[]>;
    incrementBy(key: string, value: number): Promise<number>;
    connect(url?: string): Promise<RedisClientType>;
}
