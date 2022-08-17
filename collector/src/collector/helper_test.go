package collector

import (
	"testing"
)

func TestCleanBytesAlreadyClean(t *testing.T) {
	input := []byte("cleanstring")
	output := cleanBytes(input)
	expected := string(input)
	if expected != output {
		t.Errorf(
			"output did not match input on clean string. Expected '%s', got '%s'",
			expected,
			output,
		)
	}
}

func TestCleanBytesNewLine(t *testing.T) {
	input := []byte("\ncleanstring_")
	output := cleanBytes(input)
	expected := "cleanstring_"
	if expected != output {
		t.Errorf(
			"output did not match expected clean string. Expected '%s', got '%s'",
			expected,
			output,
		)
	}
}

func TestCleanBytesNull(t *testing.T) {
	input := []byte("\u0000cleanstring")
	output := cleanBytes(input)
	expected := "cleanstring"
	if expected != output {
		t.Errorf(
			"output did not match expected clean string. Expected '%s', got '%s'",
			expected,
			output,
		)
	}
}
