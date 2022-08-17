package queue

import (
	"github.com/gomodule/redigo/redis"
	"github.com/mars-protocol/multichain-liquidator-bot/runtime/helpers"
)

// Redis implements a Redis queue using the LIST datastructure
type Redis struct {
	// conn holds the Redis connection
	conn redis.Conn
	// key is the LIST key in Redis
	key string
	// popTimeout defines the maximum amount of seconds to wait for a Redis
	// BLPOP call to return data before returning nil
	popTimeout int
}

// NewRedis creates a new instance of a Redis queue
// endpoint is the full URL of the Redis endpoint
// database is the Redis database to use
// queue is the name of the Redis key to keep the list at
func NewRedis(endpoint string, database int, queueName string, popTimeout int) (*Redis, error) {
	// Open the Redis connection
	conn, err := redis.Dial(
		"tcp",
		endpoint,
		// The Redis database number (0-15)
		redis.DialDatabase(database),
	)

	return &Redis{
		conn:       conn,
		key:        queueName,
		popTimeout: popTimeout,
	}, err
}

// Connect to a Redis instance
func (queue *Redis) Connect() error {
	// We already have a connection, this will error
	// if the connection is not usable
	return queue.conn.Err()
}

// Push pushes byte data onto the Redis list at key
func (queue *Redis) Push(data []byte) error {
	// RPUSH returns an integer of items pushed and possibly an error
	// https://redis.io/commands/rpush/
	_, err := redis.Int(queue.conn.Do("RPUSH", queue.key, data))
	return err
}

// PushMany pushes multiple items onto the queue
func (queue *Redis) PushMany(data [][]byte) error {
	// We can possibly receive quite a large amount of items in data. We batch
	// these together in groups of 100 to push in batches
	dataChunks := helpers.ChunkSlice(data, 100)
	for _, dataChunk := range dataChunks {
		// RPUSH returns an integer of items pushed and possibly an error
		// https://redis.io/commands/rpush/
		_, err := redis.Int(queue.conn.Do("RPUSH", redis.Args{}.Add(queue.key).AddFlat(dataChunk)...))
		if err != nil {
			return err
		}
	}
	return nil
}

// Fetch retrieves a single item from the Redis list at key and returns a byte
// slice of data
func (queue *Redis) Fetch() ([]byte, error) {
	// BLPOP returns the first element from key by waiting up to popTimeout
	// for an element to be available
	// https://redis.io/commands/blpop/
	parts, err := redis.Values(queue.conn.Do("BLPOP", queue.key, queue.popTimeout))
	if err != nil {
		// The ErrNil error indicates nothing was available at the given key
		if err == redis.ErrNil {
			return nil, nil
		}
		return nil, err
	}
	// The result is an array, parts[0] is the key the value comes from and
	// parts[1] is the value in bytes
	switch v := parts[1].(type) {
	case []byte:
		return v, nil
	}
	return nil, nil
}

// FetchMany retrieves multiple items from the Redis list at key
// and returns a list of byte slices up to count
func (queue *Redis) FetchMany(count int) ([][]byte, error) {
	var items [][]byte

	// LPOP returns count number of elements from the key
	// https://redis.io/commands/lpop/
	values, err := redis.Values(queue.conn.Do("LPOP", queue.key, count))
	if err != nil {
		// The ErrNil error indicates nothing was available at the given key
		if err == redis.ErrNil {
			return items, nil
		}
		return items, err
	}
	// Values are in a generic []interface{} type, get them back to an array
	// of byte items
	for _, value := range values {
		switch v := value.(type) {
		case []byte:
			items = append(items, v)
		}
	}

	return items, nil
}

// Disconnect from a Redis instance
func (queue *Redis) Disconnect() error {
	queue.conn.Flush()
	return queue.conn.Close()
}
