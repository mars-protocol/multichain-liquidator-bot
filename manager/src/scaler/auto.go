package scaler

// Auto implements an automatic up and down scaler to ensure the amount of
// active services fall between the given watermark levels
type Auto struct {
}

// NewAuto creates a new instance of the automatic scaler with the given
// watermark parameters
func NewAuto() (*Auto, error) {
	return &Auto{}, nil
}

// Scale the given service up or down based on parameters
func (auto *Auto) Scale() error {
	return nil
}