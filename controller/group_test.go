package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserGroupsExposesConfiguredDefaultAutoGroup(t *testing.T) {
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	require.NoError(t, db.Create(&model.User{
		Id:       1,
		Username: "auto-group-user",
		Password: "password",
		Group:    "default",
	}).Error)

	originalDefault := setting.DefaultUseAutoGroup
	originalAutoGroups := setting.AutoGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		setting.DefaultUseAutoGroup = originalDefault
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio))
	})

	setting.DefaultUseAutoGroup = true
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["route"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"route":"Primary route"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"route":1}`))

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/user/self/groups", nil, 1)
	GetUserGroups(ctx)

	var response struct {
		Success bool                              `json:"success"`
		Data    map[string]map[string]interface{} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Contains(t, response.Data, "route")
	assert.Contains(t, response.Data, "auto")

	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["private"]`))
	ctx, recorder = newAuthenticatedContext(t, http.MethodGet, "/api/user/self/groups", nil, 1)
	GetUserGroups(ctx)
	response.Data = nil
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.NotContains(t, response.Data, "auto")

	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["route"]`))
	setting.DefaultUseAutoGroup = false
	ctx, recorder = newAuthenticatedContext(t, http.MethodGet, "/api/user/self/groups", nil, 1)
	GetUserGroups(ctx)
	response.Data = nil
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.NotContains(t, response.Data, "auto")
}
