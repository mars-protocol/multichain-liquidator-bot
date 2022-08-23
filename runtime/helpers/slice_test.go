package helpers_test

import (
	"testing"

	"github.com/mars-protocol/multichain-liquidator-bot/runtime/helpers"
)

func TestChunkSliceEven(t *testing.T) {
	input := [][]byte{
		[]byte("item1"),
		[]byte("item2"),
		[]byte("item3"),
		[]byte("item4"),
	}

	expectedLength := 2
	chunks := helpers.ChunkSlice(input, 2)

	if len(chunks) != expectedLength {
		t.Errorf(
			"incorrect amount of chunks created. Expected %d, got %d",
			expectedLength,
			len(chunks),
		)
	}
}

func TestChunkSliceOdd(t *testing.T) {
	input := [][]byte{
		[]byte("item1"),
		[]byte("item2"),
		[]byte("item3"),
		[]byte("item4"),
		[]byte("item5"),
	}

	expectedLength := 3
	chunks := helpers.ChunkSlice(input, 2)

	if len(chunks) != expectedLength {
		t.Errorf(
			"incorrect amount of chunks created. Expected %d, got %d",
			expectedLength,
			len(chunks),
		)
	}

	expectedLastChunkSize := 1
	actualLastChunkSize := len(chunks[len(chunks)-1])
	if actualLastChunkSize != expectedLastChunkSize {
		t.Errorf(
			"incorrect amount of items in last chunk. Expected %d, got %d",
			expectedLastChunkSize,
			actualLastChunkSize,
		)
	}
}
