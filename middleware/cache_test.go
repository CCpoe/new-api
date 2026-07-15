package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCacheHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "root document", path: "/", want: "no-cache"},
		{name: "image document", path: "/image/", want: "no-cache"},
		{name: "image service worker", path: "/image/sw.js", want: "no-cache"},
		{name: "theme hashed asset", path: "/assets/app.js", want: "public, max-age=31536000, immutable"},
		{name: "image hashed asset", path: "/image/assets/app.js", want: "public, max-age=31536000, immutable"},
		{name: "other static file", path: "/logo.png", want: "public, max-age=604800"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(Cache())
			router.GET("/*path", func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})

			request, err := http.NewRequest(http.MethodGet, tt.path, nil)
			require.NoError(t, err)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			assert.Equal(t, tt.want, response.Header().Get("Cache-Control"))
		})
	}
}
