package interfaces

// Cacher defines the available actions for caches
type Cacher interface {
	// Connect to the queue
	Connect() error
	// Set a float value at key
	Set(key string, value interface{}) error
	// Get an float value at key
	GetFloat64(key string) (float64, error)
	// IncrementBy increments the value at key by the given value
	IncrementBy(key string, value int64) error
	// Delete a key
	Delete(key string) error
	// Disconnect from the queue
	Disconnect() error
}
