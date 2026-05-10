package controller

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const (
	alipayProductionGateway = "https://openapi.alipay.com/gateway.do"
	alipaySandboxGateway    = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	alipayTradePagePay      = "alipay.trade.page.pay"
	alipaySignTypeRSA2      = "RSA2"
	alipayProductCodePage   = "FAST_INSTANT_TRADE_PAY"
)

type AlipayPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

type alipayTradePagePayBizContent struct {
	OutTradeNo  string `json:"out_trade_no"`
	TotalAmount string `json:"total_amount"`
	Subject     string `json:"subject"`
	ProductCode string `json:"product_code"`
}

func RequestAlipayAmount(c *gin.Context) {
	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "invalid parameters"})
		return
	}

	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Alipay is not configured"})
		return
	}

	if req.Amount < getAlipayMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("topup amount must be at least %d", getAlipayMinTopup())})
		return
	}

	if req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "topup amount must not exceed 10000"})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "failed to get user group"})
		return
	}

	payMoney := getAlipayPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "topup amount is too low"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func RequestAlipayPay(c *gin.Context) {
	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "invalid parameters"})
		return
	}

	if req.PaymentMethod != model.PaymentMethodAlipay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "unsupported payment gateway"})
		return
	}

	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Alipay is not configured"})
		return
	}

	if req.Amount < getAlipayMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("topup amount must be at least %d", getAlipayMinTopup())})
		return
	}

	if req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "topup amount must not exceed 10000"})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "failed to get user group"})
		return
	}

	payMoney := getAlipayPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "topup amount is too low"})
		return
	}

	tradeNo := fmt.Sprintf("ALI%d%s%d", id, common.GetRandomString(6), time.Now().UnixMilli())
	paymentAmount := decimal.NewFromFloat(payMoney).Round(2).StringFixed(2)
	notifyURL := getAlipayNotifyURL()
	returnURL := getAlipayReturnURL()
	paymentURL, err := genAlipayPagePayURL(tradeNo, paymentAmount, fmt.Sprintf("Account top-up %d", req.Amount), notifyURL, returnURL)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay create payment URL failed user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "failed to start payment"})
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay create topup order failed user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "failed to create order"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Alipay topup order created user_id=%d trade_no=%s amount=%d money=%.2f notify_url=%q return_url=%q", id, tradeNo, req.Amount, payMoney, notifyURL, returnURL))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": paymentURL,
			"order_id": tradeNo,
		},
	})
}

func alipayNotifyLogFields(params map[string]string) map[string]string {
	keys := []string{"app_id", "out_trade_no", "trade_no", "trade_status", "total_amount", "sign_type"}
	fields := make(map[string]string, len(keys))
	for _, key := range keys {
		if value := strings.TrimSpace(params[key]); value != "" {
			fields[key] = value
		}
	}
	return fields
}

func AlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay notify rejected reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay notify parse form failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	params := make(map[string]string, len(c.Request.Form))
	for key := range c.Request.Form {
		params[key] = c.Request.Form.Get(key)
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Alipay notify received path=%q client_ip=%s params=%q", c.Request.RequestURI, c.ClientIP(), common.GetJsonString(alipayNotifyLogFields(params))))
	if len(params) == 0 {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if err := verifyAlipayNotify(params); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay notify verify failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	tradeStatus := strings.TrimSpace(params["trade_status"])
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("Alipay notify ignored trade_no=%s trade_status=%s client_ip=%s", params["out_trade_no"], tradeStatus, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("success"))
		return
	}

	tradeNo := strings.TrimSpace(params["out_trade_no"])
	if tradeNo == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay notify missing out_trade_no client_ip=%s", c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay notify order not found trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if topUp.PaymentProvider != model.PaymentProviderAlipay {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay notify provider mismatch trade_no=%s order_provider=%s client_ip=%s", tradeNo, topUp.PaymentProvider, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if ok := alipayAmountMatches(params["total_amount"], topUp.Money); !ok {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay notify amount mismatch trade_no=%s notify_amount=%s order_money=%.2f client_ip=%s", tradeNo, params["total_amount"], topUp.Money, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if topUp.Status == common.TopUpStatusSuccess {
		_, _ = c.Writer.Write([]byte("success"))
		return
	}

	if err := model.RechargeAlipay(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay recharge failed trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Alipay recharge succeeded trade_no=%s alipay_trade_no=%s client_ip=%s", tradeNo, params["trade_no"], c.ClientIP()))
	_, _ = c.Writer.Write([]byte("success"))
}

func genAlipayPagePayURL(tradeNo string, totalAmount string, subject string, notifyURL string, returnURL string) (string, error) {
	bizContent, err := common.Marshal(alipayTradePagePayBizContent{
		OutTradeNo:  tradeNo,
		TotalAmount: totalAmount,
		Subject:     subject,
		ProductCode: alipayProductCodePage,
	})
	if err != nil {
		return "", err
	}

	params := map[string]string{
		"app_id":      strings.TrimSpace(setting.AlipayAppId),
		"method":      alipayTradePagePay,
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   alipaySignTypeRSA2,
		"timestamp":   time.Now().Format("2006-01-02 15:04:05"),
		"version":     "1.0",
		"biz_content": string(bizContent),
	}
	if notifyURL != "" {
		params["notify_url"] = notifyURL
	}
	if returnURL != "" {
		params["return_url"] = returnURL
	}

	sign, err := signAlipayParams(params)
	if err != nil {
		return "", err
	}
	params["sign"] = sign

	query := url.Values{}
	for key, value := range params {
		query.Set(key, value)
	}

	return getAlipayGatewayURL() + "?" + query.Encode(), nil
}

func signAlipayParams(params map[string]string) (string, error) {
	privateKey, err := parseAlipayPrivateKey(setting.AlipayPrivateKey)
	if err != nil {
		return "", err
	}

	signContent := buildAlipaySignContent(params, false)
	digest := sha256.Sum256([]byte(signContent))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(signature), nil
}

func verifyAlipayNotify(params map[string]string) error {
	if strings.TrimSpace(params["app_id"]) != strings.TrimSpace(setting.AlipayAppId) {
		return errors.New("app_id mismatch")
	}
	if strings.TrimSpace(params["sign_type"]) != alipaySignTypeRSA2 {
		return errors.New("unsupported sign_type")
	}

	signatureText := strings.TrimSpace(params["sign"])
	if signatureText == "" {
		return errors.New("missing sign")
	}
	signature, err := base64.StdEncoding.DecodeString(signatureText)
	if err != nil {
		return err
	}
	publicKey, err := parseAlipayPublicKey(setting.AlipayPublicKey)
	if err != nil {
		return err
	}

	if verifyAlipaySignature(publicKey, buildAlipaySignContent(params, true), signature) == nil {
		return nil
	}

	return verifyAlipaySignature(publicKey, buildAlipaySignContent(params, false), signature)
}

func verifyAlipaySignature(publicKey *rsa.PublicKey, signContent string, signature []byte) error {
	digest := sha256.Sum256([]byte(signContent))
	return rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, digest[:], signature)
}

func buildAlipaySignContent(params map[string]string, excludeSignType bool) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if key == "sign" || (excludeSignType && key == "sign_type") || strings.TrimSpace(value) == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+params[key])
	}
	return strings.Join(parts, "&")
}

func parseAlipayPrivateKey(raw string) (*rsa.PrivateKey, error) {
	derBytes, err := decodePEMOrBase64Key(raw)
	if err != nil {
		return nil, err
	}

	if key, err := x509.ParsePKCS1PrivateKey(derBytes); err == nil {
		return key, nil
	}

	parsed, err := x509.ParsePKCS8PrivateKey(derBytes)
	if err != nil {
		return nil, err
	}
	privateKey, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("private key is not RSA")
	}
	return privateKey, nil
}

func parseAlipayPublicKey(raw string) (*rsa.PublicKey, error) {
	derBytes, err := decodePEMOrBase64Key(raw)
	if err != nil {
		return nil, err
	}

	if parsed, err := x509.ParsePKIXPublicKey(derBytes); err == nil {
		if publicKey, ok := parsed.(*rsa.PublicKey); ok {
			return publicKey, nil
		}
	}

	if publicKey, err := x509.ParsePKCS1PublicKey(derBytes); err == nil {
		return publicKey, nil
	}

	if cert, err := x509.ParseCertificate(derBytes); err == nil {
		if publicKey, ok := cert.PublicKey.(*rsa.PublicKey); ok {
			return publicKey, nil
		}
	}

	return nil, errors.New("public key is not RSA")
}

func decodePEMOrBase64Key(raw string) ([]byte, error) {
	cleaned := strings.TrimSpace(strings.ReplaceAll(raw, `\n`, "\n"))
	if cleaned == "" {
		return nil, errors.New("key is empty")
	}

	if block, _ := pem.Decode([]byte(cleaned)); block != nil {
		return block.Bytes, nil
	}

	compact := strings.NewReplacer("\r", "", "\n", "", "\t", "", " ", "").Replace(cleaned)
	return base64.StdEncoding.DecodeString(compact)
}

func getAlipayPayMoney(amount int64, group string) float64 {
	dAmount := decimal.NewFromInt(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		dAmount = dAmount.Div(dQuotaPerUnit)
	}

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]; ok && ds > 0 {
		discount = ds
	}

	payMoney := dAmount.
		Mul(decimal.NewFromFloat(setting.AlipayUnitPrice)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount))

	return payMoney.InexactFloat64()
}

func getAlipayMinTopup() int64 {
	minTopup := setting.AlipayMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dMinTopup := decimal.NewFromInt(int64(minTopup))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		minTopup = int(dMinTopup.Mul(dQuotaPerUnit).IntPart())
	}
	return int64(minTopup)
}

func getAlipayGatewayURL() string {
	if setting.AlipaySandbox {
		return alipaySandboxGateway
	}
	return alipayProductionGateway
}

func getAlipayNotifyURL() string {
	if strings.TrimSpace(setting.AlipayNotifyUrl) != "" {
		return strings.TrimRight(strings.TrimSpace(setting.AlipayNotifyUrl), "/")
	}
	return strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/alipay/notify"
}

func getAlipayReturnURL() string {
	if strings.TrimSpace(setting.AlipayReturnUrl) != "" {
		return strings.TrimSpace(setting.AlipayReturnUrl)
	}
	return strings.TrimRight(system_setting.ServerAddress, "/") + "/console/log"
}

func alipayAmountMatches(actual string, expected float64) bool {
	actualAmount, err := decimal.NewFromString(strings.TrimSpace(actual))
	if err != nil {
		return false
	}
	expectedAmount := decimal.NewFromFloat(expected).Round(2)
	return actualAmount.Round(2).Equal(expectedAmount)
}
