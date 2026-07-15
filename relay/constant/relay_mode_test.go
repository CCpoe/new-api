package constant

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeRelayPath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "public image generation", path: "/v1/images/generations", want: "/v1/images/generations"},
		{name: "playground image generation", path: "/pg/images/generations", want: "/v1/images/generations"},
		{name: "playground image edits", path: "/pg/images/edits", want: "/v1/images/edits"},
		{name: "playground responses", path: "/pg/responses", want: "/v1/responses"},
		{name: "unrelated path", path: "/api/status", want: "/api/status"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, test.want, NormalizeRelayPath(test.path))
		})
	}
}

func TestPath2RelayModeSupportsPlaygroundImageRoutes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		path string
		want int
	}{
		{path: "/pg/chat/completions", want: RelayModeChatCompletions},
		{path: "/pg/images/generations", want: RelayModeImagesGenerations},
		{path: "/pg/images/edits", want: RelayModeImagesEdits},
		{path: "/pg/responses", want: RelayModeResponses},
	}

	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, test.want, Path2RelayMode(test.path))
		})
	}
}
