package controller

import (
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRegistrationAffiliateCode(t *testing.T) {
	testCases := []struct {
		name     string
		bodyCode string
		query    string
		expected string
	}{
		{
			name:     "body code takes precedence",
			bodyCode: " body-code ",
			query:    "query-code",
			expected: "body-code",
		},
		{
			name:     "query code is a compatibility fallback",
			query:    " query-code ",
			expected: "query-code",
		},
		{
			name: "missing code remains empty",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			context.Request = httptest.NewRequest("POST", "/api/user/register?aff="+url.QueryEscape(testCase.query), nil)
			assert.Equal(t, testCase.expected, registrationAffiliateCode(context, testCase.bodyCode))
		})
	}
}
