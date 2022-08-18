package collector

import (
	"strings"
	"unicode"
)

// cleanBytes removes all non-printable values from the given string as bytes
// and returns the clean string
// TODO: This migh require an update once we know the key format for
// Red Bank and Credit Account
func cleanBytes(s []byte) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}
		return -1
	}, string(s))
}
