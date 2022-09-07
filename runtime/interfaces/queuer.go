package interfaces

// Queuer defines the available actions for queues
type Queuer interface {
	// Connect to the queue
	Connect() error
	// Push pushes data onto the queue at key
	Push(string, []byte) error
	// PushMany pushes multiple items onto the queue at key
	PushMany(string, [][]byte) error
	// Fetch retrieves a single item from the queue at key and returns a
	// byte slice of data
	Fetch(string) ([]byte, error)
	// FetchMany retrieves up to the specified count from the queue at key and
	// returns a slive of byte slices
	FetchMany(string, int) ([][]byte, error)
	// CountItems counts the amount of items in the given queue
	CountItems(string) (int, error)
	// Purge all items from the given queue
	Purge(string) error
	// Disconnect from the queue
	Disconnect() error
}
