package common

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/static"
)

// Credit: https://github.com/gin-contrib/static/issues/19

type embedFileSystem struct {
	http.FileSystem
}

func (e *embedFileSystem) Exists(prefix string, path string) bool {
	_, err := e.Open(path)
	if err != nil {
		return false
	}
	return true
}

func (e *embedFileSystem) Open(name string) (http.File, error) {
	if name == "/" {
		// This will make sure the index page goes to NoRouter handler,
		// which will use the replaced index bytes with analytic codes.
		return nil, os.ErrNotExist
	}
	return e.FileSystem.Open(name)
}

func EmbedFolder(fsEmbed embed.FS, targetPath string) static.ServeFileSystem {
	efs, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		panic(err)
	}
	return &embedFileSystem{
		FileSystem: http.FS(efs),
	}
}

// themeAwareFileSystem delegates to the appropriate embedded FS based on
// the current theme (via GetTheme). This enables runtime theme switching
// without restarting the server.
type themeAwareFileSystem struct {
	defaultFS static.ServeFileSystem
	classicFS static.ServeFileSystem
}

func (t *themeAwareFileSystem) Exists(prefix string, path string) bool {
	if GetTheme() == "classic" {
		return t.classicFS.Exists(prefix, path)
	}
	if isClassicHomeAssetPath(path) && t.classicFS.Exists(prefix, path) {
		return true
	}
	return t.defaultFS.Exists(prefix, path)
}

func (t *themeAwareFileSystem) Open(name string) (http.File, error) {
	if GetTheme() == "classic" {
		return t.classicFS.Open(name)
	}
	if isClassicHomeAssetPath(name) {
		if file, err := t.classicFS.Open(name); err == nil {
			return file, nil
		}
	}
	return t.defaultFS.Open(name)
}

func NewThemeAwareFS(defaultFS, classicFS static.ServeFileSystem) static.ServeFileSystem {
	return &themeAwareFileSystem{defaultFS: defaultFS, classicFS: classicFS}
}

func isClassicHomeAssetPath(path string) bool {
	if path == "" {
		return false
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	if strings.HasPrefix(path, "/assets/") {
		return true
	}

	switch path {
	case "/aihubmix-card-concurrency-1.png",
		"/aihubmix-card-concurrency-2.png",
		"/aihubmix-card-concurrency-3.png",
		"/aihubmix-world-map.svg",
		"/kkcode-coverage-map.png",
		"/kkcode-logo.svg":
		return true
	default:
		return false
	}
}
