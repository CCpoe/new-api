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

const WORKBENCH_URL = '/image/?integration=kkcode';
const IFRAME_LOAD_TIMEOUT_MS = 20000;

const ImageGeneration = () => {
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
  }, [iframeKey]);

  const reloadIframe = () => {
    setIframeStatus('loading');
    setIframeKey((currentKey) => currentKey + 1);
  };

  const hasLoadError = iframeStatus === 'error' || iframeStatus === 'timeout';

  return (
    <main className='mt-[64px] flex h-[calc(100vh-64px)] min-h-0 w-full flex-col overflow-hidden bg-semi-color-bg-0 supports-[height:100dvh]:h-[calc(100dvh-64px)]'>
      <div className='flex h-12 shrink-0 items-center justify-between gap-3 border-b border-semi-color-border bg-semi-color-bg-1 px-3 sm:px-4'>
        <h1 className='truncate text-base font-semibold'>{t('生成图片')}</h1>
        <div className='flex shrink-0 items-center gap-1'>
          <Tooltip content={t('重试')}>
            <Button
              aria-label={t('重试')}
              icon={<RefreshCw size={16} />}
              type='tertiary'
              onClick={reloadIframe}
            />
          </Tooltip>
          <Button
            icon={<ExternalLink size={16} />}
            type='tertiary'
            onClick={() =>
              window.open(WORKBENCH_URL, '_blank', 'noopener,noreferrer')
            }
          >
            {t('新窗口打开')}
          </Button>
        </div>
      </div>

      <div className='relative min-h-0 flex-1 overflow-hidden'>
        <iframe
          key={iframeKey}
          title={t('生成图片')}
          src={WORKBENCH_URL}
          className='size-full border-0 bg-semi-color-bg-0'
          allow='clipboard-read; clipboard-write'
          onLoad={() => setIframeStatus('ready')}
          onError={() => setIframeStatus('error')}
        />

        {iframeStatus === 'loading' && (
          <div className='absolute inset-0 flex items-center justify-center bg-semi-color-bg-0'>
            <Spin size='large' tip={t('加载中...')} />
          </div>
        )}

        {hasLoadError && (
          <div className='absolute inset-0 flex flex-col items-center justify-center gap-4 bg-semi-color-bg-0 p-6 text-center'>
            <Empty
              image={
                <IllustrationFailure style={{ width: 180, height: 180 }} />
              }
              darkModeImage={
                <IllustrationFailureDark style={{ width: 180, height: 180 }} />
              }
              description={t('加载失败')}
            />
            <Button
              icon={<RefreshCw size={16} />}
              theme='solid'
              type='primary'
              onClick={reloadIframe}
            >
              {t('重试')}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
};

export default ImageGeneration;
