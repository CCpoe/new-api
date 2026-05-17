package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestStripeWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	originalAPISecret := setting.StripeApiSecret
	originalWebhookSecret := setting.StripeWebhookSecret
	originalPriceID := setting.StripePriceId
	t.Cleanup(func() {
		setting.StripeApiSecret = originalAPISecret
		setting.StripeWebhookSecret = originalWebhookSecret
		setting.StripePriceId = originalPriceID
	})

	setting.StripeWebhookSecret = ""
	setting.StripeApiSecret = "sk_test_123"
	setting.StripePriceId = "price_123"
	require.False(t, isStripeWebhookEnabled())

	setting.StripeWebhookSecret = "whsec_test"
	require.True(t, isStripeWebhookEnabled())

	setting.StripePriceId = ""
	require.False(t, isStripeWebhookEnabled())
}

func TestCreemWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	originalAPIKey := setting.CreemApiKey
	originalProducts := setting.CreemProducts
	originalWebhookSecret := setting.CreemWebhookSecret
	t.Cleanup(func() {
		setting.CreemApiKey = originalAPIKey
		setting.CreemProducts = originalProducts
		setting.CreemWebhookSecret = originalWebhookSecret
	})

	setting.CreemWebhookSecret = ""
	setting.CreemApiKey = "creem_api_key"
	setting.CreemProducts = `[{"productId":"prod_123"}]`
	require.False(t, isCreemWebhookEnabled())

	setting.CreemWebhookSecret = "creem_secret"
	require.True(t, isCreemWebhookEnabled())

	setting.CreemProducts = "[]"
	require.False(t, isCreemWebhookEnabled())
}

func TestAlipayWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppId
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppId = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
	})

	setting.AlipayEnabled = true
	setting.AlipayAppId = "app_123"
	setting.AlipayPrivateKey = "private"
	setting.AlipayPublicKey = ""
	require.False(t, isAlipayWebhookEnabled())

	setting.AlipayPublicKey = "public"
	require.True(t, isAlipayWebhookEnabled())

	setting.AlipayEnabled = false
	require.False(t, isAlipayWebhookEnabled())
}

func TestEpayTopUpEnabledIgnoresOfficialGatewayMethods(t *testing.T) {
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "merchant"
	operation_setting.EpayKey = "secret"
	operation_setting.PayMethods = []map[string]string{
		{"name": "Alipay Official", "type": model.PaymentMethodAlipay},
		{"name": "Stripe", "type": model.PaymentMethodStripe},
	}

	require.False(t, isEpayTopUpEnabled())

	operation_setting.PayMethods = append(operation_setting.PayMethods, map[string]string{"name": "Alipay", "type": "alipay"})
	require.True(t, isEpayTopUpEnabled())
}

func TestFilterAvailablePayMethodsRequiresMatchingProvider(t *testing.T) {
	methods := []map[string]string{
		{"name": "Alipay", "type": "alipay"},
		{"name": "WeChat Pay", "type": "wxpay"},
		{"name": "Alipay Official", "type": model.PaymentMethodAlipay},
		{"name": "Stripe", "type": model.PaymentMethodStripe},
	}

	filtered := filterAvailablePayMethods(methods, false, false, true, false, false, false)
	require.Len(t, filtered, 1)
	require.Equal(t, model.PaymentMethodAlipay, filtered[0]["type"])

	filtered = filterAvailablePayMethods(methods, true, false, false, false, false, false)
	require.Len(t, filtered, 2)
	require.Equal(t, "alipay", filtered[0]["type"])
	require.Equal(t, "wxpay", filtered[1]["type"])
}

func TestAlipayRequestSignContentIncludesSignType(t *testing.T) {
	params := map[string]string{
		"app_id":    "2021000000000000",
		"method":    alipayTradePagePay,
		"sign_type": alipaySignTypeRSA2,
		"timestamp": "2026-05-11 03:24:58",
		"version":   "1.0",
		"sign":      "ignored",
	}

	signContent := buildAlipaySignContent(params, false)

	require.Contains(t, signContent, "sign_type=RSA2")
	require.NotContains(t, signContent, "sign=ignored")
}

func TestAlipayNotifyLogFieldsOmitsSensitiveFields(t *testing.T) {
	fields := alipayNotifyLogFields(map[string]string{
		"app_id":         "2021000000000000",
		"out_trade_no":   "ALI123",
		"trade_no":       "202605112200123456",
		"trade_status":   "TRADE_SUCCESS",
		"total_amount":   "7.30",
		"sign_type":      "RSA2",
		"sign":           "signature",
		"buyer_id":       "buyer-123",
		"buyer_logon_id": "user@example.com",
	})

	require.Equal(t, "ALI123", fields["out_trade_no"])
	require.NotContains(t, fields, "sign")
	require.NotContains(t, fields, "buyer_id")
	require.NotContains(t, fields, "buyer_logon_id")
}

func TestWaffoWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	originalEnabled := setting.WaffoEnabled
	originalSandbox := setting.WaffoSandbox
	originalAPIKey := setting.WaffoApiKey
	originalPrivateKey := setting.WaffoPrivateKey
	originalPublicCert := setting.WaffoPublicCert
	originalSandboxAPIKey := setting.WaffoSandboxApiKey
	originalSandboxPrivateKey := setting.WaffoSandboxPrivateKey
	originalSandboxPublicCert := setting.WaffoSandboxPublicCert
	t.Cleanup(func() {
		setting.WaffoEnabled = originalEnabled
		setting.WaffoSandbox = originalSandbox
		setting.WaffoApiKey = originalAPIKey
		setting.WaffoPrivateKey = originalPrivateKey
		setting.WaffoPublicCert = originalPublicCert
		setting.WaffoSandboxApiKey = originalSandboxAPIKey
		setting.WaffoSandboxPrivateKey = originalSandboxPrivateKey
		setting.WaffoSandboxPublicCert = originalSandboxPublicCert
	})

	setting.WaffoEnabled = true
	setting.WaffoSandbox = false
	setting.WaffoApiKey = ""
	setting.WaffoPrivateKey = "private"
	setting.WaffoPublicCert = "public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoApiKey = "api"
	require.True(t, isWaffoWebhookEnabled())

	setting.WaffoEnabled = false
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoEnabled = true
	setting.WaffoSandbox = true
	setting.WaffoSandboxApiKey = ""
	setting.WaffoSandboxPrivateKey = "sandbox_private"
	setting.WaffoSandboxPublicCert = "sandbox_public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoSandboxApiKey = "sandbox_api"
	require.True(t, isWaffoWebhookEnabled())
}

func TestWaffoPancakeWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	originalEnabled := setting.WaffoPancakeEnabled
	originalSandbox := setting.WaffoPancakeSandbox
	originalMerchantID := setting.WaffoPancakeMerchantID
	originalPrivateKey := setting.WaffoPancakePrivateKey
	originalWebhookPublicKey := setting.WaffoPancakeWebhookPublicKey
	originalWebhookTestKey := setting.WaffoPancakeWebhookTestKey
	originalStoreID := setting.WaffoPancakeStoreID
	originalProductID := setting.WaffoPancakeProductID
	t.Cleanup(func() {
		setting.WaffoPancakeEnabled = originalEnabled
		setting.WaffoPancakeSandbox = originalSandbox
		setting.WaffoPancakeMerchantID = originalMerchantID
		setting.WaffoPancakePrivateKey = originalPrivateKey
		setting.WaffoPancakeWebhookPublicKey = originalWebhookPublicKey
		setting.WaffoPancakeWebhookTestKey = originalWebhookTestKey
		setting.WaffoPancakeStoreID = originalStoreID
		setting.WaffoPancakeProductID = originalProductID
	})

	setting.WaffoPancakeEnabled = true
	setting.WaffoPancakeSandbox = false
	setting.WaffoPancakeMerchantID = "merchant"
	setting.WaffoPancakePrivateKey = "private"
	setting.WaffoPancakeStoreID = "store"
	setting.WaffoPancakeProductID = "product"
	setting.WaffoPancakeWebhookPublicKey = ""
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeWebhookPublicKey = "public"
	require.True(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeEnabled = false
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeEnabled = true
	setting.WaffoPancakeSandbox = true
	setting.WaffoPancakeWebhookTestKey = ""
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeWebhookTestKey = "test_public"
	require.True(t, isWaffoPancakeWebhookEnabled())
}

func TestEpayWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = ""
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	require.False(t, isEpayWebhookEnabled())

	operation_setting.EpayKey = "epay_key"
	require.True(t, isEpayWebhookEnabled())

	operation_setting.PayMethods = nil
	require.False(t, isEpayWebhookEnabled())
}
