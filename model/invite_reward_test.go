package model

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func configureInviteRewardTest(t *testing.T, registrationReward int, firstTopUpReward int, inviteeReward int) {
	t.Helper()
	oldRegistrationReward := common.QuotaForInviter
	oldFirstTopUpReward := common.QuotaForInviterFirstTopUp
	oldInviteeReward := common.QuotaForInvitee
	oldNewUserReward := common.QuotaForNewUser
	oldQuotaPerUnit := common.QuotaPerUnit
	paymentSetting := operation_setting.GetPaymentSetting()
	oldPaymentSetting := *paymentSetting
	t.Cleanup(func() {
		common.QuotaForInviter = oldRegistrationReward
		common.QuotaForInviterFirstTopUp = oldFirstTopUpReward
		common.QuotaForInvitee = oldInviteeReward
		common.QuotaForNewUser = oldNewUserReward
		common.QuotaPerUnit = oldQuotaPerUnit
		*paymentSetting = oldPaymentSetting
	})

	common.QuotaForInviter = registrationReward
	common.QuotaForInviterFirstTopUp = firstTopUpReward
	common.QuotaForInvitee = inviteeReward
	common.QuotaForNewUser = 0
	common.QuotaPerUnit = 500000
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
}

func createInviteRewardTestUser(t *testing.T, username string, inviterId int) *User {
	t.Helper()
	user := &User{
		Username:    username,
		DisplayName: username,
		Status:      common.UserStatusEnabled,
		Role:        common.RoleCommonUser,
		InviterId:   inviterId,
		AffCode:     common.GetRandomString(8),
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func TestUserInsertGrantsRegistrationInviteRewardAtomically(t *testing.T) {
	truncateTables(t)
	configureInviteRewardTest(t, 1000, 2000, 300)

	inviter := createInviteRewardTestUser(t, "registration_inviter", 0)
	invitee := &User{
		Username:    "registration_invitee",
		Password:    "password123",
		DisplayName: "registration_invitee",
		Status:      common.UserStatusEnabled,
		Role:        common.RoleCommonUser,
	}
	require.NoError(t, invitee.Insert(inviter.Id))

	var storedInvitee User
	require.NoError(t, DB.First(&storedInvitee, invitee.Id).Error)
	assert.Equal(t, inviter.Id, storedInvitee.InviterId)
	assert.Equal(t, 300, storedInvitee.Quota)

	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Equal(t, 1, storedInviter.AffCount)
	assert.Equal(t, 1000, storedInviter.AffQuota)
	assert.Equal(t, 1000, storedInviter.AffHistoryQuota)

	var event InviteRewardEvent
	require.NoError(t, DB.Where("invitee_id = ? AND kind = ?", invitee.Id, InviteRewardKindRegistration).First(&event).Error)
	assert.Equal(t, inviter.Id, event.InviterId)
	assert.Equal(t, 1000, event.Quota)
}

func TestUserInsertIgnoresMissingInviter(t *testing.T) {
	truncateTables(t)
	configureInviteRewardTest(t, 1000, 2000, 300)

	invitee := &User{
		Username:    "missing_inviter_invitee",
		Password:    "password123",
		DisplayName: "missing_inviter_invitee",
		Status:      common.UserStatusEnabled,
		Role:        common.RoleCommonUser,
	}
	require.NoError(t, invitee.Insert(999999))

	var stored User
	require.NoError(t, DB.First(&stored, invitee.Id).Error)
	assert.Zero(t, stored.InviterId)
	assert.Zero(t, stored.Quota)

	var count int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestFirstEligibleTopUpRewardsInviterOnlyOnce(t *testing.T) {
	truncateTables(t)
	configureInviteRewardTest(t, 1000, 2000, 0)

	inviter := createInviteRewardTestUser(t, "topup_inviter", 0)
	invitee := createInviteRewardTestUser(t, "topup_invitee", inviter.Id)
	first := &TopUp{
		UserId:          invitee.Id,
		Amount:          2,
		Money:           2,
		TradeNo:         "first-eligible-topup",
		PaymentMethod:   "wxpay",
		PaymentProvider: PaymentProviderEpay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, first.Insert())
	require.NoError(t, RechargeEpay(first.TradeNo, "alipay", "127.0.0.1"))
	require.NoError(t, RechargeEpay(first.TradeNo, "alipay", "127.0.0.1"))
	assert.Equal(t, "alipay", GetTopUpByTradeNo(first.TradeNo).PaymentMethod)

	second := &TopUp{
		UserId:          invitee.Id,
		Amount:          2,
		Money:           2,
		TradeNo:         "second-eligible-topup",
		PaymentMethod:   PaymentMethodWaffo,
		PaymentProvider: PaymentProviderWaffo,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, second.Insert())
	require.NoError(t, RechargeWaffo(second.TradeNo, "127.0.0.1"))

	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Equal(t, 2000, storedInviter.AffQuota)
	assert.Equal(t, 2000, storedInviter.AffHistoryQuota)

	var events []InviteRewardEvent
	require.NoError(t, DB.Where("invitee_id = ? AND kind = ?", invitee.Id, InviteRewardKindFirstTopUp).Find(&events).Error)
	require.Len(t, events, 1)
	assert.Equal(t, first.TradeNo, events[0].TradeNo)
	assert.Equal(t, 2000, events[0].Quota)
}

func TestConcurrentEpayCallbacksGrantFirstTopUpRewardOnce(t *testing.T) {
	truncateTables(t)
	configureInviteRewardTest(t, 1000, 2000, 0)

	inviter := createInviteRewardTestUser(t, "concurrent_callback_inviter", 0)
	invitee := createInviteRewardTestUser(t, "concurrent_callback_invitee", inviter.Id)
	topUp := &TopUp{
		UserId:          invitee.Id,
		Amount:          2,
		Money:           2,
		TradeNo:         "concurrent-epay-callback",
		PaymentMethod:   "wxpay",
		PaymentProvider: PaymentProviderEpay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	start := make(chan struct{})
	errors := make(chan error, 2)
	var waitGroup sync.WaitGroup
	for range 2 {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			errors <- RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1")
		}()
	}
	close(start)
	waitGroup.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}

	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Equal(t, 2000, storedInviter.AffQuota)
	assert.Equal(t, 2000, storedInviter.AffHistoryQuota)

	var storedInvitee User
	require.NoError(t, DB.First(&storedInvitee, invitee.Id).Error)
	assert.Equal(t, common.QuotaFromFloat(2*common.QuotaPerUnit), storedInvitee.Quota)

	var count int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).
		Where("invitee_id = ? AND kind = ?", invitee.Id, InviteRewardKindFirstTopUp).
		Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestEveryEligibleProviderGrantsFirstTopUpReward(t *testing.T) {
	testCases := []struct {
		name          string
		provider      string
		paymentMethod string
		amount        int64
		settle        func(string) error
	}{
		{
			name:          "stripe",
			provider:      PaymentProviderStripe,
			paymentMethod: PaymentMethodStripe,
			amount:        2,
			settle: func(tradeNo string) error {
				return Recharge(tradeNo, "cus_invite_reward", "127.0.0.1")
			},
		},
		{
			name:          "epay",
			provider:      PaymentProviderEpay,
			paymentMethod: "wxpay",
			amount:        2,
			settle: func(tradeNo string) error {
				return RechargeEpay(tradeNo, "alipay", "127.0.0.1")
			},
		},
		{
			name:          "creem",
			provider:      PaymentProviderCreem,
			paymentMethod: PaymentMethodCreem,
			amount:        1000,
			settle: func(tradeNo string) error {
				return RechargeCreem(tradeNo, "invite-reward@example.com", "Invite Reward", "127.0.0.1")
			},
		},
		{
			name:          "waffo",
			provider:      PaymentProviderWaffo,
			paymentMethod: PaymentMethodWaffo,
			amount:        2,
			settle: func(tradeNo string) error {
				return RechargeWaffo(tradeNo, "127.0.0.1")
			},
		},
		{
			name:          "alipay",
			provider:      PaymentProviderAlipay,
			paymentMethod: PaymentMethodAlipay,
			amount:        2,
			settle: func(tradeNo string) error {
				return RechargeAlipay(tradeNo, "127.0.0.1")
			},
		},
		{
			name:          "lakala",
			provider:      PaymentProviderLakala,
			paymentMethod: PaymentMethodLakala,
			amount:        2,
			settle: func(tradeNo string) error {
				return RechargeLakala(tradeNo, "127.0.0.1")
			},
		},
		{
			name:          "waffo_pancake",
			provider:      PaymentProviderWaffoPancake,
			paymentMethod: PaymentMethodWaffoPancake,
			amount:        2,
			settle: func(tradeNo string) error {
				return RechargeWaffoPancake(tradeNo)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			truncateTables(t)
			configureInviteRewardTest(t, 0, 2000, 0)

			inviter := createInviteRewardTestUser(t, testCase.name+"_provider_inviter", 0)
			invitee := createInviteRewardTestUser(t, testCase.name+"_provider_invitee", inviter.Id)
			topUp := &TopUp{
				UserId:          invitee.Id,
				Amount:          testCase.amount,
				Money:           2,
				TradeNo:         "eligible-provider-" + testCase.name,
				PaymentMethod:   testCase.paymentMethod,
				PaymentProvider: testCase.provider,
				CreateTime:      time.Now().Unix(),
				Status:          common.TopUpStatusPending,
			}
			require.NoError(t, topUp.Insert())
			require.NoError(t, testCase.settle(topUp.TradeNo))

			var event InviteRewardEvent
			require.NoError(t, DB.Where("invitee_id = ? AND kind = ?", invitee.Id, InviteRewardKindFirstTopUp).
				First(&event).Error)
			assert.Equal(t, inviter.Id, event.InviterId)
			assert.Equal(t, 2000, event.Quota)
			assert.Equal(t, topUp.TradeNo, event.TradeNo)
		})
	}
}

func TestIneligibleTopUpDoesNotGrantFirstTopUpReward(t *testing.T) {
	truncateTables(t)
	configureInviteRewardTest(t, 0, 2000, 0)

	inviter := createInviteRewardTestUser(t, "ineligible_topup_inviter", 0)
	invitee := createInviteRewardTestUser(t, "ineligible_topup_invitee", inviter.Id)
	topUp := &TopUp{
		UserId:          invitee.Id,
		Amount:          2,
		Money:           2,
		TradeNo:         "ineligible-balance-topup",
		PaymentMethod:   PaymentMethodBalance,
		PaymentProvider: PaymentProviderBalance,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	require.NoError(t, ManualCompleteTopUp(topUp.TradeNo, "127.0.0.1"))

	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Zero(t, storedInviter.AffQuota)
	assert.Zero(t, storedInviter.AffHistoryQuota)

	var count int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).
		Where("invitee_id = ? AND kind = ?", invitee.Id, InviteRewardKindFirstTopUp).
		Count(&count).Error)
	assert.Zero(t, count)

	eligibleTopUp := &TopUp{
		UserId:          invitee.Id,
		Amount:          2,
		Money:           2,
		TradeNo:         "eligible-after-balance-topup",
		PaymentMethod:   PaymentMethodWaffo,
		PaymentProvider: PaymentProviderWaffo,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, eligibleTopUp.Insert())
	require.NoError(t, RechargeWaffo(eligibleTopUp.TradeNo, "127.0.0.1"))

	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Equal(t, 2000, storedInviter.AffQuota)
	assert.Equal(t, 2000, storedInviter.AffHistoryQuota)

	var event InviteRewardEvent
	require.NoError(t, DB.Where("invitee_id = ? AND kind = ?", invitee.Id, InviteRewardKindFirstTopUp).
		First(&event).Error)
	assert.Equal(t, eligibleTopUp.TradeNo, event.TradeNo)
}

func TestExistingSuccessfulTopUpPreventsFirstTopUpReward(t *testing.T) {
	truncateTables(t)
	configureInviteRewardTest(t, 1000, 2000, 0)

	inviter := createInviteRewardTestUser(t, "history_inviter", 0)
	invitee := createInviteRewardTestUser(t, "history_invitee", inviter.Id)
	require.NoError(t, DB.Create(&TopUp{
		UserId:        invitee.Id,
		Amount:        1,
		Money:         1,
		TradeNo:       "historical-successful-topup",
		PaymentMethod: PaymentMethodStripe,
		CreateTime:    time.Now().Add(-time.Hour).Unix(),
		CompleteTime:  time.Now().Add(-time.Hour).Unix(),
		Status:        common.TopUpStatusSuccess,
	}).Error)

	current := &TopUp{
		UserId:          invitee.Id,
		Amount:          2,
		Money:           2,
		TradeNo:         "post-rollout-topup",
		PaymentMethod:   PaymentMethodWaffo,
		PaymentProvider: PaymentProviderWaffo,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, current.Insert())
	require.NoError(t, RechargeWaffo(current.TradeNo, "127.0.0.1"))

	var storedInviter User
	require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
	assert.Zero(t, storedInviter.AffQuota)
	assert.Zero(t, storedInviter.AffHistoryQuota)

	var count int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Where("invitee_id = ? AND kind = ?", invitee.Id, InviteRewardKindFirstTopUp).Count(&count).Error)
	assert.Zero(t, count)
}

func TestTopUpWithoutInviterDoesNotGrantInviteReward(t *testing.T) {
	truncateTables(t)
	configureInviteRewardTest(t, 1000, 2000, 0)

	user := createInviteRewardTestUser(t, "uninvited_topup_user", 0)
	topUp := &TopUp{
		UserId:          user.Id,
		Amount:          2,
		Money:           2,
		TradeNo:         "uninvited-topup",
		PaymentMethod:   PaymentMethodWaffo,
		PaymentProvider: PaymentProviderWaffo,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	require.NoError(t, RechargeWaffo(topUp.TradeNo, "127.0.0.1"))

	var count int64
	require.NoError(t, DB.Model(&InviteRewardEvent{}).Count(&count).Error)
	assert.Zero(t, count)
}
