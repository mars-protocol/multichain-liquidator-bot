package collector

// cleanBytes removes all non-alphanumeric values from the given string as bytes
// and returns the clean string
// See https://stackoverflow.com/a/54463943/1241479 for more information
func cleanBytes(s []byte) string {
	j := 0
	for _, b := range s {
		if ('a' <= b && b <= 'z') ||
			('A' <= b && b <= 'Z') ||
			('0' <= b && b <= '9') ||
			b == ' ' {
			s[j] = b
			j++
		}
	}
	return string(s[:j])
}
