package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	InviteRewardKindRegistration = "registration"
	InviteRewardKindFirstTopUp   = "first_topup"
)

type InviteRewardEvent struct {
	Id        int    `json:"id"`
	InviterId int    `json:"inviter_id" gorm:"index"`
	InviteeId int    `json:"invitee_id" gorm:"uniqueIndex:idx_invite_reward_milestone,priority:1"`
	Kind      string `json:"kind" gorm:"type:varchar(32);uniqueIndex:idx_invite_reward_milestone,priority:2"`
	Quota     int    `json:"quota"`
	TradeNo   string `json:"trade_no" gorm:"type:varchar(255);index"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
}

type InviteRewardGrant struct {
	InviterId int
	InviteeId int
	Kind      string
	Quota     int
	TradeNo   string
}

var eligibleInviteRewardProviders = []string{
	PaymentProviderEpay,
	PaymentProviderAlipay,
	PaymentProviderLakala,
	PaymentProviderStripe,
	PaymentProviderCreem,
	PaymentProviderWaffo,
	PaymentProviderWaffoPancake,
}

func boundedInviteReward(configured int, inviter *User) int {
	if configured <= 0 {
		return 0
	}
	reward := configured
	if available := common.MaxQuota - inviter.AffQuota; reward > available {
		reward = available
	}
	if available := common.MaxQuota - inviter.AffHistoryQuota; reward > available {
		reward = available
	}
	if reward < 0 {
		reward = 0
	}
	if reward != configured {
		common.SysError(fmt.Sprintf("invitation reward for inviter %d was limited from %d to %d to avoid quota overflow", inviter.Id, configured, reward))
	}
	return reward
}

func grantRegistrationInviteRewardWithTx(tx *gorm.DB, inviter *User, inviteeId int) (*InviteRewardGrant, error) {
	reward := 0
	if operation_setting.IsPaymentComplianceConfirmed() {
		reward = boundedInviteReward(common.QuotaForInviter, inviter)
	}

	event := &InviteRewardEvent{
		InviterId: inviter.Id,
		InviteeId: inviteeId,
		Kind:      InviteRewardKindRegistration,
		Quota:     reward,
	}
	if err := tx.Create(event).Error; err != nil {
		return nil, err
	}

	affCount := inviter.AffCount
	if affCount < common.MaxQuota {
		affCount++
	} else {
		common.SysError(fmt.Sprintf("invitation count for inviter %d reached the database limit", inviter.Id))
	}
	if err := tx.Model(&User{}).Where("id = ?", inviter.Id).Updates(map[string]interface{}{
		"aff_count":   affCount,
		"aff_quota":   inviter.AffQuota + reward,
		"aff_history": inviter.AffHistoryQuota + reward,
	}).Error; err != nil {
		return nil, err
	}

	return &InviteRewardGrant{
		InviterId: inviter.Id,
		InviteeId: inviteeId,
		Kind:      InviteRewardKindRegistration,
		Quota:     reward,
	}, nil
}

func settleFirstTopUpInviteRewardWithTx(tx *gorm.DB, topUp *TopUp) (*InviteRewardGrant, error) {
	if topUp == nil || topUp.Id == 0 || !operation_setting.IsPaymentComplianceConfirmed() || common.QuotaForInviterFirstTopUp <= 0 {
		return nil, nil
	}
	eligible := false
	for _, provider := range eligibleInviteRewardProviders {
		if topUp.PaymentProvider == provider {
			eligible = true
			break
		}
	}
	if !eligible {
		return nil, nil
	}

	invitee := &User{}
	if err := lockForUpdate(tx).Select("id", "inviter_id").Where("id = ?", topUp.UserId).First(invitee).Error; err != nil {
		return nil, err
	}
	if invitee.InviterId == 0 {
		return nil, nil
	}

	var earlierTopUps int64
	if err := tx.Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND id <> ?", topUp.UserId, common.TopUpStatusSuccess, topUp.Id).
		Where("(payment_provider IN ? OR (payment_provider = ? AND amount > 0))", eligibleInviteRewardProviders, "").
		Count(&earlierTopUps).Error; err != nil {
		return nil, err
	}
	if earlierTopUps > 0 {
		return nil, nil
	}

	inviter := &User{}
	if err := lockForUpdate(tx).Select("id", "aff_quota", "aff_history").Where("id = ?", invitee.InviterId).First(inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	reward := boundedInviteReward(common.QuotaForInviterFirstTopUp, inviter)
	event := &InviteRewardEvent{
		InviterId: inviter.Id,
		InviteeId: invitee.Id,
		Kind:      InviteRewardKindFirstTopUp,
		Quota:     reward,
		TradeNo:   topUp.TradeNo,
	}
	result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(event)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}

	if err := tx.Model(&User{}).Where("id = ?", inviter.Id).Updates(map[string]interface{}{
		"aff_quota":   inviter.AffQuota + reward,
		"aff_history": inviter.AffHistoryQuota + reward,
	}).Error; err != nil {
		return nil, err
	}

	return &InviteRewardGrant{
		InviterId: inviter.Id,
		InviteeId: invitee.Id,
		Kind:      InviteRewardKindFirstTopUp,
		Quota:     reward,
		TradeNo:   topUp.TradeNo,
	}, nil
}

func recordInviteRewardGrant(grant *InviteRewardGrant) {
	if grant == nil || grant.Quota <= 0 {
		return
	}
	content := fmt.Sprintf("邀请用户 %d 注册成功，赠送 %s", grant.InviteeId, logger.LogQuota(grant.Quota))
	if grant.Kind == InviteRewardKindFirstTopUp {
		content = fmt.Sprintf("邀请用户 %d 完成首次在线充值，赠送 %s", grant.InviteeId, logger.LogQuota(grant.Quota))
	}
	RecordLog(grant.InviterId, LogTypeSystem, content)
}
