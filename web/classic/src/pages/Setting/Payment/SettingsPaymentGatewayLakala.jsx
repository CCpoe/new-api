/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef, useState } from 'react';
import { Banner, Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import { BookOpen, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
  toBoolean,
} from '../../../helpers';

export default function SettingsPaymentGatewayLakala(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle
    ? undefined
    : t('Lakala Gateway');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    LakalaEnabled: false,
    LakalaSandbox: false,
    LakalaAppId: '',
    LakalaSerialNo: '',
    LakalaPrivateKey: '',
    LakalaPublicKey: '',
    LakalaMerchantId: '',
    LakalaTermNo: '',
    LakalaPayMode: 'ALIPAY',
    LakalaTransType: '41',
    LakalaOrderSource: '',
    LakalaNotifyUrl: '',
    LakalaReturnUrl: '',
    LakalaUnitPrice: 7.3,
    LakalaMinTopUp: 1,
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        LakalaEnabled: toBoolean(props.options.LakalaEnabled),
        LakalaSandbox: toBoolean(props.options.LakalaSandbox),
        LakalaAppId: props.options.LakalaAppId || '',
        LakalaSerialNo: props.options.LakalaSerialNo || '',
        LakalaPrivateKey: props.options.LakalaPrivateKey || '',
        LakalaPublicKey: props.options.LakalaPublicKey || '',
        LakalaMerchantId: props.options.LakalaMerchantId || '',
        LakalaTermNo: props.options.LakalaTermNo || '',
        LakalaPayMode: props.options.LakalaPayMode || 'ALIPAY',
        LakalaTransType: props.options.LakalaTransType || '41',
        LakalaOrderSource: props.options.LakalaOrderSource || '',
        LakalaNotifyUrl: props.options.LakalaNotifyUrl || '',
        LakalaReturnUrl: props.options.LakalaReturnUrl || '',
        LakalaUnitPrice:
          props.options.LakalaUnitPrice !== undefined
            ? parseFloat(props.options.LakalaUnitPrice)
            : 7.3,
        LakalaMinTopUp:
          props.options.LakalaMinTopUp !== undefined
            ? parseFloat(props.options.LakalaMinTopUp)
            : 1,
      };

      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitLakalaSetting = async () => {
    const values = {
      ...inputs,
      LakalaEnabled: toBoolean(inputs.LakalaEnabled),
      LakalaSandbox: toBoolean(inputs.LakalaSandbox),
      LakalaAppId: (inputs.LakalaAppId || '').trim(),
      LakalaSerialNo: (inputs.LakalaSerialNo || '').trim(),
      LakalaPrivateKey: (inputs.LakalaPrivateKey || '').trim(),
      LakalaPublicKey: (inputs.LakalaPublicKey || '').trim(),
      LakalaMerchantId: (inputs.LakalaMerchantId || '').trim(),
      LakalaTermNo: (inputs.LakalaTermNo || '').trim(),
      LakalaPayMode: (inputs.LakalaPayMode || 'ALIPAY').trim(),
      LakalaTransType: (inputs.LakalaTransType || '41').trim(),
      LakalaOrderSource: (inputs.LakalaOrderSource || '').trim(),
      LakalaNotifyUrl: removeTrailingSlash(inputs.LakalaNotifyUrl || ''),
      LakalaReturnUrl: removeTrailingSlash(inputs.LakalaReturnUrl || ''),
    };

    if (values.LakalaEnabled && !values.LakalaAppId) {
      showError(t('Lakala App ID is required'));
      return;
    }
    if (values.LakalaEnabled && !values.LakalaSerialNo) {
      showError(t('Lakala certificate serial number is required'));
      return;
    }
    if (values.LakalaEnabled && !values.LakalaMerchantId) {
      showError(t('Lakala merchant number is required'));
      return;
    }
    if (values.LakalaEnabled && !values.LakalaTermNo) {
      showError(t('Lakala terminal number is required'));
      return;
    }
    if (values.LakalaEnabled && !values.LakalaPublicKey) {
      showError(t('Lakala public key is required'));
      return;
    }
    if (values.LakalaEnabled && Number(values.LakalaUnitPrice) <= 0) {
      showError(t('Unit price must be greater than 0'));
      return;
    }
    if (values.LakalaEnabled && Number(values.LakalaMinTopUp) < 1) {
      showError(t('Minimum top-up amount must be at least 1'));
      return;
    }

    setLoading(true);
    try {
      const options = [
        { key: 'LakalaEnabled', value: values.LakalaEnabled ? 'true' : 'false' },
        { key: 'LakalaSandbox', value: values.LakalaSandbox ? 'true' : 'false' },
        { key: 'LakalaAppId', value: values.LakalaAppId },
        { key: 'LakalaSerialNo', value: values.LakalaSerialNo },
        { key: 'LakalaPublicKey', value: values.LakalaPublicKey },
        { key: 'LakalaMerchantId', value: values.LakalaMerchantId },
        { key: 'LakalaTermNo', value: values.LakalaTermNo },
        { key: 'LakalaPayMode', value: values.LakalaPayMode || 'ALIPAY' },
        { key: 'LakalaTransType', value: values.LakalaTransType || '41' },
        { key: 'LakalaOrderSource', value: values.LakalaOrderSource },
        { key: 'LakalaNotifyUrl', value: values.LakalaNotifyUrl },
        { key: 'LakalaReturnUrl', value: values.LakalaReturnUrl },
        { key: 'LakalaUnitPrice', value: String(values.LakalaUnitPrice ?? 7.3) },
        { key: 'LakalaMinTopUp', value: String(values.LakalaMinTopUp ?? 1) },
      ];

      if (values.LakalaPrivateKey) {
        options.push({ key: 'LakalaPrivateKey', value: values.LakalaPrivateKey });
      }

      const results = await Promise.all(
        options.map((opt) => API.put('/api/option/', opt)),
      );

      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data.message));
      } else {
        showSuccess(t('Updated successfully'));
        props.refresh?.();
      }
    } catch (error) {
      showError(t('Update failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={sectionTitle}>
          <Banner
            type='info'
            icon={<BookOpen size={16} />}
            description={
              <>
                {t('Direct integration with Lakala Open Platform')}
                <br />
                {t('Notify URL:')}{' '}
                {props.options.ServerAddress
                  ? removeTrailingSlash(props.options.ServerAddress)
                  : t('Server address')}
                /api/lakala/notify
              </>
            }
            style={{ marginBottom: 12 }}
          />
          <Banner
            type='warning'
            icon={<TriangleAlert size={16} />}
            description={t(
              'Use the Lakala merchant platform to configure merchant notification if your order source requires it.',
            )}
            style={{ marginBottom: 16 }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field='LakalaEnabled'
                label={t('Allow users to pay with Lakala')}
                checkedText='On'
                uncheckedText='Off'
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field='LakalaSandbox'
                label={t('Sandbox mode')}
                checkedText='On'
                uncheckedText='Off'
                extraText={t('Use the Lakala sandbox gateway')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='LakalaAppId'
                label={t('App ID')}
                placeholder='OP00000000000000'
                extraText={t('Application ID from Lakala Open Platform')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='LakalaSerialNo'
                label={t('Certificate serial number')}
                placeholder='1234567890ABCDEF'
                extraText={t('Lakala application certificate serial number')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='LakalaMerchantId'
                label={t('Merchant ID')}
                placeholder='822xxxxxxxxxxxx'
                extraText={t('Lakala merchant number')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='LakalaTermNo'
                label={t('Terminal number')}
                placeholder='29034705'
                extraText={t('Lakala terminal number')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Select
                field='LakalaPayMode'
                label={t('Pay mode')}
                optionList={[
                  { label: 'Alipay', value: 'ALIPAY' },
                  { label: 'WeChat', value: 'WECHAT' },
                  { label: 'UQRCODEPAY', value: 'UQRCODEPAY' },
                  { label: 'DCPAY', value: 'DCPAY' },
                  { label: 'LKLACC', value: 'LKLACC' },
                ]}
                extraText={t('Payment channel used for Lakala pre-order')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Select
                field='LakalaTransType'
                label={t('Transaction type')}
                optionList={[
                  { label: '41 NATIVE', value: '41' },
                  { label: '51 JSAPI', value: '51' },
                  { label: '81 Alipay H5', value: '81' },
                ]}
                extraText={t('Use 41 for QR code payments')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='LakalaOrderSource'
                label={t('Order source')}
                placeholder='gateway'
                extraText={t('Optional external order source used by Lakala notifications')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='LakalaNotifyUrl'
                label={t('Notify URL override')}
                placeholder='https://gateway.example.com/api/lakala/notify'
                extraText={t('Leave blank to use the server address callback')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='LakalaReturnUrl'
                label={t('Return URL')}
                placeholder='https://gateway.example.com/console/topup?show_history=true'
                extraText={t('Browser redirect after payment completion')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='LakalaUnitPrice'
                precision={2}
                min={0}
                label={t('Unit price (CNY / USD)')}
                extraText={t('Amount charged per USD of balance')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='LakalaMinTopUp'
                min={1}
                label={t('Minimum top-up (USD)')}
                extraText={t('Minimum recharge amount in USD')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='LakalaPrivateKey'
                label={t('Application private key')}
                placeholder={t('Enter new private key to update')}
                extraText={t('RSA2 application private key, leave blank unless updating')}
                autosize={{ minRows: 4, maxRows: 8 }}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='LakalaPublicKey'
                label={t('Lakala public key or certificate')}
                placeholder='MIIBIjANBgkq...'
                extraText={t('Lakala public key or platform certificate used to verify responses and notifications')}
                autosize={{ minRows: 4, maxRows: 8 }}
              />
            </Col>
          </Row>

          <Button onClick={submitLakalaSetting} style={{ marginTop: 16 }}>
            {t('Save Lakala settings')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
