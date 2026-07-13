package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupInUserUsableGroupsHandlesAutoGroup(t *testing.T) {
	originalDefault := setting.DefaultUseAutoGroup
	originalAutoGroups := setting.AutoGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		setting.DefaultUseAutoGroup = originalDefault
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})

	setting.DefaultUseAutoGroup = true
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["route"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"route":"Primary route"}`))
	assert.True(t, GroupInUserUsableGroups("default", "auto"))

	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["private"]`))
	assert.False(t, GroupInUserUsableGroups("default", "auto"))

	setting.DefaultUseAutoGroup = false
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["route"]`))
	assert.False(t, GroupInUserUsableGroups("default", "auto"))

	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"route":"Primary route","auto":"Auto routing"}`))
	assert.True(t, GroupInUserUsableGroups("default", "auto"))
}
