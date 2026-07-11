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

import React, { useState } from 'react';
import { Button, Card, Spin, Typography } from '@douyinfe/semi-ui';
import { ExternalLink, RefreshCw } from 'lucide-react';

const { Text } = Typography;

const ShopIframePanel = ({ t, shopUrl }) => {
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  if (!shopUrl) {
    return null;
  }

  const refreshIframe = () => {
    setFailed(false);
    setLoading(true);
    setIframeKey((value) => value + 1);
  };

  return (
    <Card
      className='!rounded-2xl shadow-sm border-0 h-full min-h-[640px]'
      bodyStyle={{
        padding: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className='flex items-center justify-between gap-3 border-b border-semi-color-border px-4 py-3'>
        <div className='min-w-0'>
          <Text strong>{t('充值地址')}</Text>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button
            icon={<RefreshCw size={15} />}
            theme='borderless'
            type='tertiary'
            aria-label={t('刷新')}
            onClick={refreshIframe}
          />
          <a href={shopUrl} target='_blank' rel='noopener noreferrer'>
            <Button
              icon={<ExternalLink size={15} />}
              theme='solid'
              type='primary'
              className='!rounded-lg'
            >
              {t('打开充值地址')}
            </Button>
          </a>
        </div>
      </div>

      <div className='relative min-h-[560px] flex-1 bg-semi-color-fill-0'>
        {loading && (
          <div className='absolute inset-0 z-10 flex items-center justify-center bg-semi-color-bg-1'>
            <Spin tip={t('加载中...')} />
          </div>
        )}

        {failed && (
          <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-semi-color-bg-1 p-6 text-center'>
            <Text type='secondary'>{t('加载失败')}</Text>
            <a href={shopUrl} target='_blank' rel='noopener noreferrer'>
              <Button
                icon={<ExternalLink size={15} />}
                theme='solid'
                type='primary'
              >
                {t('打开充值地址')}
              </Button>
            </a>
          </div>
        )}

        <iframe
          key={iframeKey}
          title={t('充值地址')}
          src={shopUrl}
          className='h-full min-h-[560px] w-full border-0 bg-white'
          allow='payment; clipboard-write'
          referrerPolicy='no-referrer-when-downgrade'
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      </div>
    </Card>
  );
};

export default ShopIframePanel;
