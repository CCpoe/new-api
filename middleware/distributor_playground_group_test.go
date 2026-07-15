package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolvePlaygroundGroup(t *testing.T) {
	originalDefault := setting.DefaultUseAutoGroup
	originalAutoGroups := setting.AutoGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		setting.DefaultUseAutoGroup = originalDefault
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})

	setting.DefaultUseAutoGroup = true
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default","vip"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))

	newContext := func(path string) *gin.Context {
		t.Helper()
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, path, nil)
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		return ctx
	}

	t.Run("image workbench defaults to auto", func(t *testing.T) {
		ctx := newContext("/pg/images/generations")
		group, err := resolvePlaygroundGroup(ctx, "default", "", "/v1/images/generations")
		require.NoError(t, err)
		assert.Equal(t, "auto", group)
	})

	t.Run("header selects an available group", func(t *testing.T) {
		ctx := newContext("/pg/responses")
		ctx.Request.Header.Set(playgroundGroupHeader, "vip")
		group, err := resolvePlaygroundGroup(ctx, "default", "", "/v1/responses")
		require.NoError(t, err)
		assert.Equal(t, "vip", group)
	})

	t.Run("body group remains supported for chat playground", func(t *testing.T) {
		ctx := newContext("/pg/chat/completions")
		group, err := resolvePlaygroundGroup(ctx, "default", "vip", "/v1/chat/completions")
		require.NoError(t, err)
		assert.Equal(t, "vip", group)
	})

	t.Run("unavailable group is rejected", func(t *testing.T) {
		ctx := newContext("/pg/images/generations")
		ctx.Request.Header.Set(playgroundGroupHeader, "private")
		_, err := resolvePlaygroundGroup(ctx, "default", "", "/v1/images/generations")
		assert.Error(t, err)
	})

	t.Run("auto falls back to the user group when auto routing is unavailable", func(t *testing.T) {
		setting.DefaultUseAutoGroup = false
		defer func() { setting.DefaultUseAutoGroup = true }()

		ctx := newContext("/pg/images/generations")
		ctx.Request.Header.Set(playgroundGroupHeader, "auto")
		group, err := resolvePlaygroundGroup(ctx, "default", "", "/v1/images/generations")
		require.NoError(t, err)
		assert.Equal(t, "default", group)
	})

	t.Run("regular relay routes ignore the playground header", func(t *testing.T) {
		ctx := newContext("/v1/images/generations")
		ctx.Request.Header.Set(playgroundGroupHeader, "vip")
		group, err := resolvePlaygroundGroup(ctx, "default", "", "/v1/images/generations")
		require.NoError(t, err)
		assert.Equal(t, "default", group)
	})
}
