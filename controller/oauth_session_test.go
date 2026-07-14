package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateOAuthCodeReplacesStaleAffiliateCode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testCases := []struct {
		name     string
		query    string
		expected any
	}{
		{name: "trim fresh code", query: "?aff=%20fresh-code%20", expected: "fresh-code"},
		{name: "clear stale code", expected: nil},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			store := cookie.NewStore([]byte("oauth-session-test-secret"))
			router := gin.New()
			router.Use(sessions.Sessions("session", store))

			var affiliateCode any
			router.GET("/oauth/state", func(c *gin.Context) {
				session := sessions.Default(c)
				session.Set("aff", "stale-code")
				GenerateOAuthCode(c)
				affiliateCode = session.Get("aff")
			})

			request := httptest.NewRequest(http.MethodGet, "/oauth/state"+testCase.query, nil)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			require.Equal(t, http.StatusOK, response.Code)
			assert.Equal(t, testCase.expected, affiliateCode)
		})
	}
}
