package interfaces

// Queuer defines the available actions for queues
type Queuer interface {
	// Connect to the queue
	Connect() error
	// Push pushes data onto the queue
	Push([]byte) error
	// PushMany pushes multiple items onto the queue
	PushMany([][]byte) error
	// Fetch retrieves a single item from the queue and returns a byte slice
	// of data
	Fetch() ([]byte, error)
	// FetchMany retrieves up to the specified count from the queue and returns
	// a list of byte slices
	FetchMany(int) ([][]byte, error)
	// Disconnect from the queue
	Disconnect() error
}
