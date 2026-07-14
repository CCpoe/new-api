package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetRechargeShop(t *testing.T) {
	originalUrl := common.LianDongShopUrl
	t.Cleanup(func() {
		common.LianDongShopUrl = originalUrl
	})

	tests := []struct {
		name       string
		configured string
		enabled    bool
		url        string
	}{
		{
			name:       "empty configuration is disabled",
			configured: "   ",
			enabled:    false,
			url:        "",
		},
		{
			name:       "configured URL is enabled and trimmed",
			configured: "  https://shop.example.com/recharge  ",
			enabled:    true,
			url:        "https://shop.example.com/recharge",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			common.LianDongShopUrl = test.configured
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)

			GetRechargeShop(ctx)

			require.Equal(t, 200, recorder.Code)
			var response struct {
				Success bool `json:"success"`
				Data    struct {
					Enabled bool   `json:"enabled"`
					URL     string `json:"url"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			require.True(t, response.Success)
			require.Equal(t, test.enabled, response.Data.Enabled)
			require.Equal(t, test.url, response.Data.URL)
		})
	}
}
