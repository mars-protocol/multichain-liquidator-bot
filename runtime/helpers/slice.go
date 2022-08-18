package helpers

// chunkSlice takes a slide of byte arrays and splits them into
// groups of chunkSize
func ChunkSlice(slice [][]byte, chunkSize int) [][][]byte {
	var chunks [][][]byte
	for {
		if len(slice) == 0 {
			break
		}

		// necessary check to avoid slicing beyond
		// slice capacity
		if len(slice) < chunkSize {
			chunkSize = len(slice)
		}

		chunks = append(chunks, slice[0:chunkSize])
		slice = slice[chunkSize:]
	}
	return chunks
}
