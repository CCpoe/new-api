package controller

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
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
	lakalaProductionPreOrderURL = "https://s2.lakala.com/labs/txn/labs_order_pre_orderpay"
	lakalaSandboxPreOrderURL    = "https://test.wsmsd.cn/sit/labs/txn/labs_order_pre_orderpay"
	lakalaAPISignType           = "LKLAPI-SHA256withRSA"
	lakalaAPIVersion            = "1.0.0"
	lakalaSuccessCode           = "000000"
	lakalaGlobalSuccess         = "GLOBAL_SUCCESS"
	lakalaDefaultPayMode        = "ALIPAY"
	lakalaDefaultTransType      = "41"
)

type LakalaPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

type lakalaGatewayRequest struct {
	ReqData     map[string]any    `json:"reqData"`
	Ver         string            `json:"ver"`
	Timestamp   string            `json:"timestamp"`
	ReqId       string            `json:"reqId"`
	TermExtInfo map[string]string `json:"termExtInfo"`
}

type lakalaPreOrderResponse struct {
	RespData   *lakalaPreOrderRespData `json:"respData"`
	Timestamp  any                     `json:"timestamp"`
	Rnd        any                     `json:"rnd"`
	Ver        string                  `json:"ver"`
	ReqId      string                  `json:"reqId"`
	RespId     any                     `json:"respId"`
	RetCode    string                  `json:"retCode"`
	RetMsg     string                  `json:"retMsg"`
	CmdRetCode string                  `json:"cmdRetCode"`
}

type lakalaPreOrderRespData struct {
	TradeTime   string `json:"tradeTime"`
	Code        string `json:"code"`
	CodeImage   string `json:"codeImage"`
	OrderId     string `json:"orderId"`
	LklOrderId  string `json:"lklOrderId"`
	FormData    string `json:"formData"`
	RedirectURL string `json:"redirectUrl"`
	PrepayId    string `json:"prepayId"`
}

type lakalaNotifyPayload struct {
	PayOrderNo            string `json:"payOrderNo"`
	MerchantOrderNo       string `json:"merchantOrderNo"`
	OrderId               string `json:"orderId"`
	ExterMerOrderNo       string `json:"exterMerOrderNo"`
	OrnOrderId            string `json:"ornOrderId"`
	MerchantNo            string `json:"merchantNo"`
	TermId                string `json:"termId"`
	TradeType             string `json:"tradeType"`
	Amount                any    `json:"amount"`
	Currency              string `json:"currency"`
	PayStatus             string `json:"payStatus"`
	ChannelId             string `json:"channelId"`
	TradeTime             string `json:"tradeTime"`
	AccountChannelOrderNo string `json:"accountChannelOrderNo"`
	LklOrderNo            string `json:"lklOrderNo"`
}

func RequestLakalaAmount(c *gin.Context) {
	var req LakalaPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "invalid parameters"})
		return
	}

	if !isLakalaTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Lakala is not configured"})
		return
	}

	if req.Amount < getLakalaMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("topup amount must be at least %d", getLakalaMinTopup())})
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

	payMoney := getLakalaPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "topup amount is too low"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func RequestLakalaPay(c *gin.Context) {
	var req LakalaPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "invalid parameters"})
		return
	}

	if req.PaymentMethod != model.PaymentMethodLakala {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "unsupported payment gateway"})
		return
	}

	if !isLakalaTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Lakala is not configured"})
		return
	}

	if req.Amount < getLakalaMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("topup amount must be at least %d", getLakalaMinTopup())})
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

	payMoney := getLakalaPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "topup amount is too low"})
		return
	}

	tradeNo := fmt.Sprintf("LKL%s%d", common.GetRandomString(10), time.Now().UnixMilli())
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
		if amount < 1 {
			amount = 1
		}
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodLakala,
		PaymentProvider: model.PaymentProviderLakala,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Lakala create topup order failed user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "failed to create order"})
		return
	}

	resp, err := createLakalaPreOrder(c, tradeNo, req.Amount, payMoney)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Lakala create payment failed user_id=%d trade_no=%s amount=%d money=%.2f error=%q", id, tradeNo, req.Amount, payMoney, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "failed to start payment"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Lakala topup order created user_id=%d trade_no=%s amount=%d money=%.2f pay_mode=%s trans_type=%s", id, tradeNo, req.Amount, payMoney, getLakalaPayMode(), getLakalaTransType()))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"qr_code":      resp.Code,
			"pay_link":     resp.Code,
			"code_image":   resp.CodeImage,
			"form_data":    resp.FormData,
			"redirect_url": resp.RedirectURL,
			"order_id":     tradeNo,
			"lkl_order_id": resp.LklOrderId,
			"pay_mode":     getLakalaPayMode(),
			"trans_type":   getLakalaTransType(),
		},
	})
}

func createLakalaPreOrder(c *gin.Context, tradeNo string, topupAmount int64, payMoney float64) (*lakalaPreOrderRespData, error) {
	fen, amountText := formatLakalaAmount(payMoney)
	if fen <= 0 {
		return nil, errors.New("invalid payment amount")
	}

	reqData := map[string]any{
		"mercId":         strings.TrimSpace(setting.LakalaMerchantId),
		"termNo":         strings.TrimSpace(setting.LakalaTermNo),
		"payMode":        getLakalaPayMode(),
		"amount":         amountText,
		"openId":         "",
		"spbillCreateIp": lakalaClientIPv4(c),
		"transType":      getLakalaTransType(),
		"orderId":        tradeNo,
		"appId":          "",
		"subject":        fmt.Sprintf("Account top-up %d", topupAmount),
	}
	if orderSource := strings.TrimSpace(setting.LakalaOrderSource); orderSource != "" {
		reqData["exterOrderSource"] = orderSource
		reqData["exterMerOrderNo"] = tradeNo
	}

	requestBody := lakalaGatewayRequest{
		ReqData:   reqData,
		Ver:       lakalaAPIVersion,
		Timestamp: strconv.FormatInt(time.Now().UnixMilli(), 10),
		ReqId:     common.GetRandomString(32),
		TermExtInfo: map[string]string{
			"termIp":   lakalaClientIPv4(c),
			"termType": "01",
		},
	}

	bodyBytes, err := common.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	respBytes, err := requestLakalaGateway(getLakalaPreOrderURL(), bodyBytes)
	if err != nil {
		return nil, err
	}

	var resp lakalaPreOrderResponse
	if err := common.Unmarshal(respBytes, &resp); err != nil {
		return nil, err
	}

	if resp.RetCode != lakalaSuccessCode || resp.CmdRetCode != lakalaGlobalSuccess || resp.RespData == nil {
		return nil, fmt.Errorf("Lakala business error: retCode=%s cmdRetCode=%s retMsg=%s", resp.RetCode, resp.CmdRetCode, resp.RetMsg)
	}

	if getLakalaTransType() == lakalaDefaultTransType && strings.TrimSpace(resp.RespData.Code) == "" {
		return nil, errors.New("Lakala response missing qr code")
	}

	return resp.RespData, nil
}

func requestLakalaGateway(endpoint string, bodyBytes []byte) ([]byte, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	nonce := common.GetRandomString(12)
	signature, err := signLakalaRequestBody(timestamp, nonce, string(bodyBytes))
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", buildLakalaAuthorizationHeader(timestamp, nonce, signature))

	client := service.GetHttpClient()
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer service.CloseResponseBodyGracefully(resp)

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("Lakala HTTP status %d: %s", resp.StatusCode, string(respBytes))
	}
	if err := verifyLakalaResponseSignature(resp.Header, string(respBytes)); err != nil {
		return nil, err
	}
	return respBytes, nil
}

func LakalaNotify(c *gin.Context) {
	if !isLakalaWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Lakala notify rejected reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		writeLakalaNotifyResponse(c, false, "webhook disabled")
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Lakala notify read body failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		writeLakalaNotifyResponse(c, false, "invalid body")
		return
	}
	bodyText := string(bodyBytes)

	if err := verifyLakalaNotifySignature(c, bodyText); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Lakala notify verify failed path=%q client_ip=%s error=%q body=%q", c.Request.RequestURI, c.ClientIP(), err.Error(), bodyText))
		writeLakalaNotifyResponse(c, false, "verify failed")
		return
	}

	var payload lakalaNotifyPayload
	if err := common.Unmarshal(bodyBytes, &payload); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Lakala notify parse failed path=%q client_ip=%s error=%q body=%q", c.Request.RequestURI, c.ClientIP(), err.Error(), bodyText))
		writeLakalaNotifyResponse(c, false, "invalid payload")
		return
	}

	tradeNo := payload.tradeNo()
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Lakala notify received trade_no=%s pay_status=%s amount=%v pay_order_no=%s lkl_order_no=%s client_ip=%s", tradeNo, payload.PayStatus, payload.Amount, payload.PayOrderNo, payload.LklOrderNo, c.ClientIP()))
	if tradeNo == "" {
		writeLakalaNotifyResponse(c, false, "missing order number")
		return
	}

	if payload.PayStatus != "S" {
		if isLakalaFailureStatus(payload.PayStatus) {
			if err := model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderLakala, common.TopUpStatusFailed); err != nil &&
				!errors.Is(err, model.ErrTopUpNotFound) &&
				!errors.Is(err, model.ErrTopUpStatusInvalid) {
				logger.LogError(c.Request.Context(), fmt.Sprintf("Lakala mark failed order failed trade_no=%s pay_status=%s error=%q", tradeNo, payload.PayStatus, err.Error()))
			}
		}
		writeLakalaNotifyResponse(c, true, "ignored")
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Lakala notify order not found trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		writeLakalaNotifyResponse(c, false, "order not found")
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderLakala {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Lakala notify provider mismatch trade_no=%s order_provider=%s client_ip=%s", tradeNo, topUp.PaymentProvider, c.ClientIP()))
		writeLakalaNotifyResponse(c, false, "provider mismatch")
		return
	}
	if !lakalaFenMatches(payload.Amount, topUp.Money) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Lakala notify amount mismatch trade_no=%s notify_amount=%v order_money=%.2f client_ip=%s", tradeNo, payload.Amount, topUp.Money, c.ClientIP()))
		writeLakalaNotifyResponse(c, false, "amount mismatch")
		return
	}

	if topUp.Status == common.TopUpStatusSuccess {
		writeLakalaNotifyResponse(c, true, "success")
		return
	}

	if err := model.RechargeLakala(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Lakala recharge failed trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		writeLakalaNotifyResponse(c, false, err.Error())
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Lakala recharge succeeded trade_no=%s pay_order_no=%s client_ip=%s", tradeNo, payload.PayOrderNo, c.ClientIP()))
	writeLakalaNotifyResponse(c, true, "success")
}

func (payload lakalaNotifyPayload) tradeNo() string {
	for _, value := range []string{payload.MerchantOrderNo, payload.OrderId, payload.ExterMerOrderNo, payload.OrnOrderId} {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func writeLakalaNotifyResponse(c *gin.Context, success bool, message string) {
	code := "FAIL"
	if success {
		code = "SUCCESS"
		if message == "" {
			message = "success"
		}
	}
	c.JSON(http.StatusOK, gin.H{"code": code, "message": message})
}

func signLakalaRequestBody(timestamp string, nonce string, body string) (string, error) {
	privateKey, err := parseAlipayPrivateKey(setting.LakalaPrivateKey)
	if err != nil {
		return "", err
	}
	signContent := buildLakalaRequestSignContent(strings.TrimSpace(setting.LakalaAppId), strings.TrimSpace(setting.LakalaSerialNo), timestamp, nonce, body)
	return signLakalaContent(privateKey, signContent)
}

func signLakalaContent(privateKey *rsa.PrivateKey, signContent string) (string, error) {
	digest := sha256.Sum256([]byte(signContent))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func verifyLakalaResponseSignature(headers http.Header, body string) error {
	signatureText := strings.TrimSpace(headers.Get("Lklapi-Signature"))
	if signatureText == "" {
		return errors.New("missing Lakala response signature")
	}
	appid := headers.Get("Lklapi-Appid")
	serialNo := headers.Get("Lklapi-Serial")
	timestamp := headers.Get("Lklapi-Timestamp")
	nonce := headers.Get("Lklapi-Nonce")
	if timestamp == "" || nonce == "" {
		return errors.New("missing Lakala response signature headers")
	}
	return verifyLakalaSignature(buildLakalaRequestSignContent(appid, serialNo, timestamp, nonce, body), signatureText)
}

func verifyLakalaNotifySignature(c *gin.Context, body string) error {
	params := parseLakalaAuthorization(c.GetHeader("Authorization"))
	timestamp := firstNonEmpty(params["timestamp"], c.GetHeader("Lklapi-Timestamp"))
	nonce := firstNonEmpty(params["nonce_str"], params["nonce"], c.GetHeader("Lklapi-Nonce"))
	signature := firstNonEmpty(params["signature"], c.GetHeader("Lklapi-Signature"))
	if timestamp == "" || nonce == "" || signature == "" {
		return errors.New("missing Lakala notify signature fields")
	}

	if err := verifyLakalaSignature(buildLakalaNotifySignContent(timestamp, nonce, body), signature); err == nil {
		return nil
	}

	appid := firstNonEmpty(params["appid"], c.GetHeader("Lklapi-Appid"))
	serialNo := firstNonEmpty(params["serial_no"], c.GetHeader("Lklapi-Serial"))
	if appid != "" || serialNo != "" {
		return verifyLakalaSignature(buildLakalaRequestSignContent(appid, serialNo, timestamp, nonce, body), signature)
	}
	return errors.New("invalid Lakala notify signature")
}

func verifyLakalaSignature(signContent string, signatureText string) error {
	signatureBytes, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signatureText))
	if err != nil {
		return err
	}
	publicKey, err := parseAlipayPublicKey(setting.LakalaPublicKey)
	if err != nil {
		return err
	}
	digest := sha256.Sum256([]byte(signContent))
	return rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, digest[:], signatureBytes)
}

func buildLakalaRequestSignContent(appid string, serialNo string, timestamp string, nonce string, body string) string {
	return appid + "\n" + serialNo + "\n" + timestamp + "\n" + nonce + "\n" + body + "\n"
}

func buildLakalaNotifySignContent(timestamp string, nonce string, body string) string {
	return timestamp + "\n" + nonce + "\n" + body + "\n"
}

func buildLakalaAuthorizationHeader(timestamp string, nonce string, signature string) string {
	return fmt.Sprintf(`%s appid="%s",serial_no="%s",timestamp="%s",nonce_str="%s",signature="%s"`, lakalaAPISignType, strings.TrimSpace(setting.LakalaAppId), strings.TrimSpace(setting.LakalaSerialNo), timestamp, nonce, signature)
}

func parseLakalaAuthorization(header string) map[string]string {
	params := map[string]string{}
	header = strings.TrimSpace(header)
	if header == "" {
		return params
	}
	if strings.HasPrefix(header, lakalaAPISignType) {
		header = strings.TrimSpace(strings.TrimPrefix(header, lakalaAPISignType))
	}
	for _, part := range strings.Split(header, ",") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok {
			continue
		}
		params[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(value), "\"'")
	}
	return params
}

func getLakalaPayMoney(amount int64, group string) float64 {
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
		Mul(decimal.NewFromFloat(setting.LakalaUnitPrice)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount))

	return payMoney.InexactFloat64()
}

func getLakalaMinTopup() int64 {
	minTopup := setting.LakalaMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dMinTopup := decimal.NewFromInt(int64(minTopup))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		minTopup = int(dMinTopup.Mul(dQuotaPerUnit).IntPart())
	}
	return int64(minTopup)
}

func getLakalaPreOrderURL() string {
	if setting.LakalaSandbox {
		return lakalaSandboxPreOrderURL
	}
	return lakalaProductionPreOrderURL
}

func getLakalaNotifyURL() string {
	if strings.TrimSpace(setting.LakalaNotifyUrl) != "" {
		return strings.TrimRight(strings.TrimSpace(setting.LakalaNotifyUrl), "/")
	}
	return strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/lakala/notify"
}

func getLakalaReturnURL() string {
	if strings.TrimSpace(setting.LakalaReturnUrl) != "" {
		return strings.TrimSpace(setting.LakalaReturnUrl)
	}
	return strings.TrimRight(system_setting.ServerAddress, "/") + "/console/topup?show_history=true"
}

func getLakalaPayMode() string {
	payMode := strings.ToUpper(strings.TrimSpace(setting.LakalaPayMode))
	if payMode == "" {
		return lakalaDefaultPayMode
	}
	return payMode
}

func getLakalaTransType() string {
	transType := strings.TrimSpace(setting.LakalaTransType)
	if transType == "" {
		return lakalaDefaultTransType
	}
	return transType
}

func formatLakalaAmount(amount float64) (int64, string) {
	fen := decimal.NewFromFloat(amount).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
	return fen, fmt.Sprintf("%012d", fen)
}

func lakalaFenMatches(actual any, expectedMoney float64) bool {
	actualFen, ok := parseLakalaFen(actual)
	if !ok {
		return false
	}
	expectedFen, _ := formatLakalaAmount(expectedMoney)
	return actualFen == expectedFen
}

func parseLakalaFen(value any) (int64, bool) {
	switch v := value.(type) {
	case nil:
		return 0, false
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return 0, false
		}
		fen, err := strconv.ParseInt(strings.TrimLeft(trimmed, "0"), 10, 64)
		if err != nil {
			if strings.Trim(trimmed, "0") == "" {
				return 0, true
			}
			return 0, false
		}
		return fen, true
	case float64:
		return int64(v), true
	case int:
		return int64(v), true
	case int64:
		return v, true
	default:
		text := common.Interface2String(v)
		if text == "" {
			return 0, false
		}
		fen, err := strconv.ParseInt(strings.TrimLeft(text, "0"), 10, 64)
		return fen, err == nil
	}
}

func isLakalaFailureStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case "F", "C", "X", "T":
		return true
	default:
		return false
	}
}

func lakalaClientIPv4(c *gin.Context) string {
	ip := c.ClientIP()
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return "127.0.0.1"
	}
	if ipv4 := parsed.To4(); ipv4 != nil {
		return ipv4.String()
	}
	return "127.0.0.1"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
