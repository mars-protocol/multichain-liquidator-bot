package mock

import (
	"fmt"

	"github.com/gomodule/redigo/redis"
	redigomock "github.com/rafaeljusto/redigomock/v3"
)

// RedisCache implements a mock Redis cache using keys
type RedisCache struct {
	// conn holds the Redis connection
	conn redis.Conn
}

// NewRedisCache creates a new instance of the Redis mock queue
// endpoint is the full URL of the Redis endpoint
// database is the Redis database to use
// queue is the name of the Redis key to keep the list at
func NewRedisCache() (*RedisCache, error) {

	conn := redigomock.NewConn()

	// Set up simulated call for adding to the list
	conn.GenericCommand("RPUSH").Handle(redigomock.ResponseHandler(func(args []interface{}) (interface{}, error) {
		if len(args) < 2 {
			return nil, fmt.Errorf("unexpected number of arguments: expected 2 or more, received %d", len(args))
		}
		return int64(len(args) - 1), nil
	}))

	// Set up simulated call for popping a single value from the list
	conn.GenericCommand("BLPOP").Handle(redigomock.ResponseHandler(func(args []interface{}) (interface{}, error) {
		if len(args) != 2 {
			return nil, fmt.Errorf("unexpected number of arguments: expected 2, received %d", len(args))
		}
		return []interface{}{args[0], []byte("testvalue")}, nil
	}))

	// Set up simulated call for popping multiple values from the list
	conn.GenericCommand("LPOP").Handle(redigomock.ResponseHandler(func(args []interface{}) (interface{}, error) {
		if len(args) != 2 {
			return nil, fmt.Errorf("unexpected number of arguments: expected 2, received %d", len(args))
		}
		return []interface{}{args[0], []byte("testvalue"), []byte("testvalue2"), []byte("testvalue3")}, nil
	}))

	// Set up simulated call for counting items in a list list
	conn.GenericCommand("LLEN").Handle(redigomock.ResponseHandler(func(args []interface{}) (interface{}, error) {
		if len(args) != 1 {
			return nil, fmt.Errorf("unexpected number of arguments: expected 1, received %d", len(args))
		}
		return int64(0), nil
	}))

	return &RedisCache{
		conn: conn,
	}, nil
}

// Connect to a Redis instance
func (cache *RedisCache) Connect() error {
	// We already have a connection, this will error
	// if the connection is not usable
	return cache.conn.Err()
}

// Set a float value at key
func (cache *RedisCache) Set(key string, value interface{}) error {
	// https://redis.io/commands/set/
	_, err := cache.conn.Do("SET", key, value)
	return err
}

// Get an float value at key
func (cache *RedisCache) GetFloat64(key string) (float64, error) {
	// https://redis.io/commands/get/
	value, err := redis.Float64(cache.conn.Do("GET", key))
	if err != nil {
		// Key not found, return 0
		if err == redis.ErrNil {
			return 0, nil
		}
	}
	return value, err
}

// IncrementBy increments the value at key by the given value
func (cache *RedisCache) IncrementBy(key string, value int64) error {
	// https://redis.io/commands/incrby/
	_, err := cache.conn.Do("INCRBY", key, value)
	return err
}

// Delete a key
func (cache *RedisCache) Delete(key string) error {
	// DEL deletes the key and acts as a clear operation
	// https://redis.io/commands/del/
	// DEL returns the amount of items deleted and an error where applicable
	_, err := redis.Int(cache.conn.Do("DEL", key))
	return err
}

// Disconnect from a Redis instance
func (cache *RedisCache) Disconnect() error {
	cache.conn.Flush()
	return cache.conn.Close()
}
