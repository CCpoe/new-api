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

import React, { useEffect, useState } from 'react';
import { Button, Empty, Spin, Tooltip } from '@douyinfe/semi-ui';
import {
  IllustrationFailure,
  IllustrationFailureDark,
} from '@douyinfe/semi-illustrations';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const IFRAME_LOAD_TIMEOUT_MS = 15000;

const RechargeIframe = ({ shopUrl }) => {
  const { t } = useTranslation();
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeStatus, setIframeStatus] = useState('loading');

  useEffect(() => {
    setIframeStatus('loading');
    const timeoutId = window.setTimeout(() => {
      setIframeStatus((currentStatus) =>
        currentStatus === 'loading' ? 'timeout' : currentStatus,
      );
    }, IFRAME_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [iframeKey, shopUrl]);

  const reloadIframe = () => {
    setIframeStatus('loading');
    setIframeKey((currentKey) => currentKey + 1);
  };

  const openInNewWindow = () => {
    window.open(shopUrl, '_blank', 'noopener,noreferrer');
  };

  const hasLoadError = iframeStatus === 'error' || iframeStatus === 'timeout';

  return (
    <div className='flex h-full min-h-0 w-full flex-col overflow-hidden bg-semi-color-bg-0'>
      <h1 className='sr-only'>{t('充值')}</h1>
      <div className='flex h-12 shrink-0 items-center justify-end gap-1 border-b border-semi-color-border bg-semi-color-bg-1 px-3'>
        <Tooltip content={t('刷新')}>
          <Button
            aria-label={t('刷新')}
            icon={<RefreshCw size={16} />}
            theme='borderless'
            type='tertiary'
            onClick={reloadIframe}
          />
        </Tooltip>
        <Tooltip content={t('打开充值地址')}>
          <Button
            aria-label={t('打开充值地址')}
            icon={<ExternalLink size={16} />}
            theme='borderless'
            type='tertiary'
            onClick={openInNewWindow}
          />
        </Tooltip>
      </div>

      <div className='relative min-h-0 flex-1 bg-white'>
        {iframeStatus === 'loading' && (
          <div className='absolute inset-0 z-10 flex items-center justify-center bg-semi-color-bg-1'>
            <Spin size='large' tip={t('加载中...')} />
          </div>
        )}

        {hasLoadError && (
          <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-semi-color-bg-1 p-6 text-center'>
            <Empty
              image={
                <IllustrationFailure style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationFailureDark style={{ width: 150, height: 150 }} />
              }
              description={t('加载失败')}
            />
            <div className='flex flex-wrap items-center justify-center gap-2'>
              <Button
                icon={<RefreshCw size={16} />}
                theme='solid'
                type='primary'
                onClick={reloadIframe}
              >
                {t('重试')}
              </Button>
              <Button
                icon={<ExternalLink size={16} />}
                theme='outline'
                type='tertiary'
                onClick={openInNewWindow}
              >
                {t('打开充值地址')}
              </Button>
            </div>
          </div>
        )}

        {!hasLoadError && (
          <iframe
            key={iframeKey}
            title={t('充值地址')}
            src={shopUrl}
            className='h-full w-full border-0 bg-white'
            allow='payment; clipboard-write'
            referrerPolicy='no-referrer-when-downgrade'
            onLoad={() => setIframeStatus('ready')}
            onError={() => setIframeStatus('error')}
          />
        )}
      </div>
    </div>
  );
};

export default RechargeIframe;
