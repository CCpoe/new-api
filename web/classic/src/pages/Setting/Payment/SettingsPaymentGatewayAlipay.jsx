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

export default function SettingsPaymentGatewayAlipay(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle
    ? undefined
    : t('Alipay Official Settings');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AlipayEnabled: false,
    AlipaySandbox: false,
    AlipayAppId: '',
    AlipayPrivateKey: '',
    AlipayPublicKey: '',
    AlipayNotifyUrl: '',
    AlipayReturnUrl: '',
    AlipayUnitPrice: 7.3,
    AlipayMinTopUp: 1,
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        AlipayEnabled: toBoolean(props.options.AlipayEnabled),
        AlipaySandbox: toBoolean(props.options.AlipaySandbox),
        AlipayAppId: props.options.AlipayAppId || '',
        AlipayPrivateKey: props.options.AlipayPrivateKey || '',
        AlipayPublicKey: props.options.AlipayPublicKey || '',
        AlipayNotifyUrl: props.options.AlipayNotifyUrl || '',
        AlipayReturnUrl: props.options.AlipayReturnUrl || '',
        AlipayUnitPrice:
          props.options.AlipayUnitPrice !== undefined
            ? parseFloat(props.options.AlipayUnitPrice)
            : 7.3,
        AlipayMinTopUp:
          props.options.AlipayMinTopUp !== undefined
            ? parseFloat(props.options.AlipayMinTopUp)
            : 1,
      };

      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitAlipaySetting = async () => {
    const values = {
      ...inputs,
      AlipayEnabled: toBoolean(inputs.AlipayEnabled),
      AlipaySandbox: toBoolean(inputs.AlipaySandbox),
      AlipayAppId: (inputs.AlipayAppId || '').trim(),
      AlipayPrivateKey: (inputs.AlipayPrivateKey || '').trim(),
      AlipayPublicKey: (inputs.AlipayPublicKey || '').trim(),
      AlipayNotifyUrl: removeTrailingSlash(inputs.AlipayNotifyUrl || ''),
      AlipayReturnUrl: removeTrailingSlash(inputs.AlipayReturnUrl || ''),
    };

    if (values.AlipayEnabled && !values.AlipayAppId) {
      showError(t('Alipay App ID is required'));
      return;
    }
    if (values.AlipayEnabled && !values.AlipayPublicKey) {
      showError(t('Alipay public key is required'));
      return;
    }
    if (values.AlipayEnabled && Number(values.AlipayUnitPrice) <= 0) {
      showError(t('Unit price must be greater than 0'));
      return;
    }
    if (values.AlipayEnabled && Number(values.AlipayMinTopUp) < 1) {
      showError(t('Minimum top-up amount must be at least 1'));
      return;
    }

    setLoading(true);
    try {
      const options = [
        {
          key: 'AlipayEnabled',
          value: values.AlipayEnabled ? 'true' : 'false',
        },
        {
          key: 'AlipaySandbox',
          value: values.AlipaySandbox ? 'true' : 'false',
        },
        { key: 'AlipayAppId', value: values.AlipayAppId },
        { key: 'AlipayPublicKey', value: values.AlipayPublicKey },
        { key: 'AlipayNotifyUrl', value: values.AlipayNotifyUrl },
        { key: 'AlipayReturnUrl', value: values.AlipayReturnUrl },
        {
          key: 'AlipayUnitPrice',
          value: String(values.AlipayUnitPrice ?? 7.3),
        },
        { key: 'AlipayMinTopUp', value: String(values.AlipayMinTopUp ?? 1) },
      ];

      if (values.AlipayPrivateKey) {
        options.push({
          key: 'AlipayPrivateKey',
          value: values.AlipayPrivateKey,
        });
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
                {t('Direct integration with Alipay Open Platform')}
                <br />
                {t('Notify URL:')}{' '}
                {props.options.ServerAddress
                  ? removeTrailingSlash(props.options.ServerAddress)
                  : t('Server address')}
                /api/alipay/notify
              </>
            }
            style={{ marginBottom: 12 }}
          />
          <Banner
            type='warning'
            icon={<TriangleAlert size={16} />}
            description={t(
              'Use RSA2 signing in the Alipay Open Platform console',
            )}
            style={{ marginBottom: 16 }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AlipayEnabled'
                label={t('Allow users to pay with official Alipay')}
                checkedText='On'
                uncheckedText='Off'
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AlipaySandbox'
                label={t('Sandbox mode')}
                checkedText='On'
                uncheckedText='Off'
                extraText={t('Use the Alipay sandbox gateway')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='AlipayAppId'
                label={t('App ID')}
                placeholder='2021000000000000'
                extraText={t('Application ID from Alipay Open Platform')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='AlipayPrivateKey'
                label={t('Application private key')}
                placeholder={t('Enter new private key to update')}
                extraText={t(
                  'RSA2 application private key, leave blank unless updating',
                )}
                autosize={{ minRows: 4, maxRows: 8 }}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='AlipayPublicKey'
                label={t('Alipay public key')}
                placeholder='MIIBIjANBgkq...'
                extraText={t(
                  'Alipay public key used to verify async notifications',
                )}
                autosize={{ minRows: 4, maxRows: 8 }}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='AlipayNotifyUrl'
                label={t('Notify URL override')}
                placeholder='https://gateway.example.com/api/alipay/notify'
                extraText={t('Leave blank to use the server address callback')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='AlipayReturnUrl'
                label={t('Return URL')}
                placeholder='https://gateway.example.com/console/log'
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
                field='AlipayUnitPrice'
                precision={2}
                min={0}
                label={t('Unit price (CNY / USD)')}
                extraText={t('Amount charged per USD of balance')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='AlipayMinTopUp'
                min={1}
                label={t('Minimum top-up (USD)')}
                extraText={t('Minimum recharge amount in USD')}
              />
            </Col>
          </Row>

          <Button onClick={submitAlipaySetting} style={{ marginTop: 16 }}>
            {t('Save Alipay settings')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
