package cache

import (
	"github.com/gomodule/redigo/redis"
)

// Redis implements a Redis cache with basic key/values
type Redis struct {
	// conn holds the Redis connection
	conn redis.Conn
}

// NewRedis creates a new instance of a Redis queue
// endpoint is the full URL of the Redis endpoint
// database is the Redis database number to use
// popTimeout is the time a BLPOP call will wait before continuing
func NewRedis(endpoint string, database int) (*Redis, error) {
	// Open the Redis connection
	conn, err := redis.Dial(
		"tcp",
		endpoint,
		// The Redis database number (0-15)
		redis.DialDatabase(database),
	)

	return &Redis{
		conn: conn,
	}, err
}

// Connect to a Redis instance
func (cache *Redis) Connect() error {
	// We already have a connection, this will error
	// if the connection is not usable
	return cache.conn.Err()
}

// Set a float value at key
func (cache *Redis) Set(key string, value interface{}) error {
	_, err := cache.conn.Do("SET", key, value)
	return err
}

// Get an float value at key
func (cache *Redis) GetFloat64(key string) (float64, error) {
	return redis.Float64(cache.conn.Do("GET", key))
}

// Delete a key
func (cache *Redis) Delete(key string) error {
	// DEL deletes the key and acts as a clear operation
	// https://redis.io/commands/del/
	// DEL returns the amount of items deleted and an error where applicable
	_, err := redis.Int(cache.conn.Do("DEL", key))
	return err
}

// Disconnect from a Redis instance
func (cache *Redis) Disconnect() error {
	cache.conn.Flush()
	return cache.conn.Close()
}
