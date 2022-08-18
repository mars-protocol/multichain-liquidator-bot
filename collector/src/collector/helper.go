package collector

import (
	"strings"
	"unicode"
)

// cleanBytes removes all non-printable values from the given string as bytes
// and returns the clean string
func cleanBytes(s []byte) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}
		return -1
	}, string(s))
}
