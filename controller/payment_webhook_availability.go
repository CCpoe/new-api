package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func isStripeTopUpEnabled() bool {
	return strings.TrimSpace(setting.StripeApiSecret) != "" &&
		strings.TrimSpace(setting.StripeWebhookSecret) != "" &&
		strings.TrimSpace(setting.StripePriceId) != ""
}

func isStripeWebhookConfigured() bool {
	return strings.TrimSpace(setting.StripeWebhookSecret) != ""
}

func isStripeWebhookEnabled() bool {
	return isStripeTopUpEnabled()
}

func isCreemTopUpEnabled() bool {
	products := strings.TrimSpace(setting.CreemProducts)
	return strings.TrimSpace(setting.CreemApiKey) != "" &&
		products != "" &&
		products != "[]"
}

func isAlipayTopUpEnabled() bool {
	if !setting.AlipayEnabled {
		return false
	}

	return isAlipayWebhookConfigured()
}

func isAlipayWebhookConfigured() bool {
	return strings.TrimSpace(setting.AlipayAppId) != "" &&
		strings.TrimSpace(setting.AlipayPrivateKey) != "" &&
		strings.TrimSpace(setting.AlipayPublicKey) != ""
}

func isAlipayWebhookEnabled() bool {
	return isAlipayTopUpEnabled()
}

func isLakalaTopUpEnabled() bool {
	if !setting.LakalaEnabled {
		return false
	}

	return isLakalaWebhookConfigured()
}

func isLakalaWebhookConfigured() bool {
	return strings.TrimSpace(setting.LakalaAppId) != "" &&
		strings.TrimSpace(setting.LakalaSerialNo) != "" &&
		strings.TrimSpace(setting.LakalaPrivateKey) != "" &&
		strings.TrimSpace(setting.LakalaPublicKey) != "" &&
		strings.TrimSpace(setting.LakalaMerchantId) != "" &&
		strings.TrimSpace(setting.LakalaTermNo) != ""
}

func isLakalaWebhookEnabled() bool {
	return isLakalaTopUpEnabled()
}

func isCreemWebhookConfigured() bool {
	return strings.TrimSpace(setting.CreemWebhookSecret) != ""
}

func isCreemWebhookEnabled() bool {
	return isCreemTopUpEnabled() && isCreemWebhookConfigured()
}

func isWaffoTopUpEnabled() bool {
	if !setting.WaffoEnabled {
		return false
	}

	return isWaffoWebhookConfigured()
}

func isWaffoWebhookConfigured() bool {
	if setting.WaffoSandbox {
		return strings.TrimSpace(setting.WaffoSandboxApiKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPrivateKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPublicCert) != ""
	}

	return strings.TrimSpace(setting.WaffoApiKey) != "" &&
		strings.TrimSpace(setting.WaffoPrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPublicCert) != ""
}

func isWaffoWebhookEnabled() bool {
	return isWaffoTopUpEnabled()
}

func isWaffoPancakeTopUpEnabled() bool {
	if !setting.WaffoPancakeEnabled {
		return false
	}

	return isWaffoPancakeWebhookConfigured() &&
		strings.TrimSpace(setting.WaffoPancakeMerchantID) != "" &&
		strings.TrimSpace(setting.WaffoPancakePrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPancakeStoreID) != "" &&
		strings.TrimSpace(setting.WaffoPancakeProductID) != ""
}

func isWaffoPancakeWebhookConfigured() bool {
	currentWebhookKey := strings.TrimSpace(setting.WaffoPancakeWebhookPublicKey)
	if setting.WaffoPancakeSandbox {
		currentWebhookKey = strings.TrimSpace(setting.WaffoPancakeWebhookTestKey)
	}

	return currentWebhookKey != ""
}

func isWaffoPancakeWebhookEnabled() bool {
	return isWaffoPancakeTopUpEnabled()
}

func isEpayPayMethod(paymentType string) bool {
	switch strings.TrimSpace(paymentType) {
	case "", model.PaymentMethodStripe, model.PaymentMethodAlipay, model.PaymentMethodLakala, model.PaymentMethodCreem, model.PaymentMethodWaffo, model.PaymentMethodWaffoPancake:
		return false
	default:
		return true
	}
}

func hasEpayPayMethod() bool {
	for _, payMethod := range operation_setting.PayMethods {
		if isEpayPayMethod(payMethod["type"]) {
			return true
		}
	}
	return false
}

func isEpayTopUpEnabled() bool {
	return isEpayWebhookConfigured() && hasEpayPayMethod()
}

func isEpayWebhookConfigured() bool {
	return strings.TrimSpace(operation_setting.PayAddress) != "" &&
		strings.TrimSpace(operation_setting.EpayId) != "" &&
		strings.TrimSpace(operation_setting.EpayKey) != ""
}

func isEpayWebhookEnabled() bool {
	return isEpayTopUpEnabled()
}
