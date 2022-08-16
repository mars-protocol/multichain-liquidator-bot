package mock

// Redis implements a mock Redis queue using the LIST datastructure that match
// the queuer inerface
type Redis struct {
}

// Connect to the queue
func (queue *Redis) Connect() error {
	return nil
}

// Push pushes data onto the queue
func (queue *Redis) Push([]byte) error {
	return nil
}

// Fetch retrieves a single item from the queue and returns a byte slice
// of data
func (queue *Redis) Fetch() ([]byte, error) {
	return nil, nil
}

// FetchMany retrieves up to the specified count from the queue and returns
// a list of byte slices
func (queue *Redis) FetchMany(int) ([][]byte, error) {
	return nil, nil
}

// Disconnect from the queue
func (queue *Redis) Disconnect() error {
	return nil
}
