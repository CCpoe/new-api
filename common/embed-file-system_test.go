package common

import (
	"net/http"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
)

func TestEmbedFileSystemExistsRespectsMountPrefix(t *testing.T) {
	t.Parallel()

	testFS := http.FS(fstest.MapFS{
		"index.html":    &fstest.MapFile{Data: []byte("index")},
		"assets/app.js": &fstest.MapFile{Data: []byte("app")},
	})

	tests := []struct {
		name   string
		prefix string
		path   string
		want   bool
	}{
		{name: "mounted asset", prefix: "/image", path: "/image/assets/app.js", want: true},
		{name: "root mounted asset", prefix: "/", path: "/assets/app.js", want: true},
		{name: "index remains delegated", prefix: "/", path: "/", want: false},
		{name: "outside prefix", prefix: "/image", path: "/image-other/assets/app.js", want: false},
		{name: "missing file", prefix: "/image", path: "/image/assets/missing.js", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			fileSystem := &embedFileSystem{FileSystem: testFS}
			assert.Equal(t, tt.want, fileSystem.Exists(tt.prefix, tt.path))
		})
	}
}
