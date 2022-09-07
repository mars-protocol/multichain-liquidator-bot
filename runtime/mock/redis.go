package mock

import (
	"fmt"

	"github.com/gomodule/redigo/redis"
	redigomock "github.com/rafaeljusto/redigomock/v3"
)

// Redis implements a mock Redis queue using the LIST datastructure that match
// the queuer inerface
type Redis struct {
	// conn holds the Redis connection
	conn redis.Conn
}

// NewRedis creates a new instance of the Redis mock queue
// endpoint is the full URL of the Redis endpoint
// database is the Redis database to use
// queue is the name of the Redis key to keep the list at
func NewRedis() (*Redis, error) {

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

	return &Redis{
		conn: conn,
	}, nil
}

// Connect to a Redis instance
func (queue *Redis) Connect() error {
	// We already have a connection, this will error
	// if the connection is not usable
	return queue.conn.Err()
}

// Push pushes byte data onto the Redis list at key
func (queue *Redis) Push(key string, data []byte) error {
	// RPUSH returns an integer of items pushed and possibly an error
	// https://redis.io/commands/rpush/
	_, err := redis.Int(queue.conn.Do("RPUSH", key, data))
	return err
}

// PushMany pushes multiple items onto the queue at key
func (queue *Redis) PushMany(key string, data [][]byte) error {
	// RPUSH returns an integer of items pushed and possibly an error
	// https://redis.io/commands/rpush/
	_, err := redis.Int(queue.conn.Do("RPUSH", redis.Args{}.Add(key).AddFlat(data)...))
	return err
}

// Fetch retrieves a single item from the Redis list at key and returns a byte
// slice of data
func (queue *Redis) Fetch(key string) ([]byte, error) {
	// BLPOP returns the first element from key by waiting up to popTimeout
	// for an element to be available
	// https://redis.io/commands/blpop/
	parts, err := redis.Values(queue.conn.Do("BLPOP", key, 5))
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
func (queue *Redis) FetchMany(key string, count int) ([][]byte, error) {
	var items [][]byte

	// LPOP returns count number of elements from the key
	// https://redis.io/commands/lpop/
	values, err := redis.Values(queue.conn.Do("LPOP", key, count))
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

// CountItems counts the amount of items in the given queue
func (queue *Redis) CountItems(key string) (int, error) {
	// LLEN returns the length of a list
	// https://redis.io/commands/llen/
	return redis.Int(queue.conn.Do("LLEN", key))
}

// Purge all items from the given queue
func (queue *Redis) Purge(key string) error {
	// DEL deletes the key and acts as a clear/purge operation
	// https://redis.io/commands/del/
	// DEL returns the amount of items deleted and an error where applicable
	_, err := redis.Int(queue.conn.Do("DEL", key))
	return err
}

// Disconnect from a Redis instance
func (queue *Redis) Disconnect() error {
	queue.conn.Flush()
	return queue.conn.Close()
}
