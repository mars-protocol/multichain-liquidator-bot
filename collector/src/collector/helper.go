package collector

import (
	"strings"
	"unicode"
)

// cleanBytes removes all non-printable values from the given string as bytes
// and returns the clean string
// TODO: This migh require an update once we know the key format for
// Red Bank and Credit Account
// See https://stackoverflow.com/a/54463943/1241479 for more information
func cleanBytes(s []byte) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}
		return -1
	}, string(s))
	// j := 0
	// for _, b := range s {
	// 	if ('a' <= b && b <= 'z') ||
	// 		('A' <= b && b <= 'Z') ||
	// 		('0' <= b && b <= '9') ||
	// 		b == ' ' {
	// 		s[j] = b
	// 		j++
	// 	}
	// }
	// return string(s[:j])
}
