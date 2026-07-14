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

import React from 'react';
import { Button, Empty, Spin } from '@douyinfe/semi-ui';
import {
  IllustrationFailure,
  IllustrationFailureDark,
  IllustrationNoContent,
  IllustrationNoContentDark,
} from '@douyinfe/semi-illustrations';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RechargeIframe from '../../components/recharge/RechargeIframe';
import { useRechargeShop } from '../../hooks/recharge/useRechargeShop';

const isSafeHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const Recharge = () => {
  const { t } = useTranslation();
  const { enabled, error, loading, reload, url } = useRechargeShop();
  const canLoadShop = enabled && isSafeHttpUrl(url);

  return (
    <main className='mt-[64px] h-[calc(100vh-64px)] min-h-0 w-full overflow-hidden supports-[height:100dvh]:h-[calc(100dvh-64px)]'>
      {loading ? (
        <div className='flex h-full items-center justify-center bg-semi-color-bg-0'>
          <Spin size='large' tip={t('加载中...')} />
        </div>
      ) : error ? (
        <div className='flex h-full flex-col items-center justify-center gap-4 bg-semi-color-bg-0 p-6 text-center'>
          <Empty
            image={<IllustrationFailure style={{ width: 180, height: 180 }} />}
            darkModeImage={
              <IllustrationFailureDark style={{ width: 180, height: 180 }} />
            }
            description={t('加载失败')}
          />
          <Button
            icon={<RefreshCw size={16} />}
            theme='solid'
            type='primary'
            onClick={reload}
          >
            {t('重试')}
          </Button>
        </div>
      ) : canLoadShop ? (
        <RechargeIframe shopUrl={url} />
      ) : (
        <div className='flex h-full items-center justify-center bg-semi-color-bg-0 p-6 text-center'>
          <Empty
            image={
              <IllustrationNoContent style={{ width: 180, height: 180 }} />
            }
            darkModeImage={
              <IllustrationNoContentDark style={{ width: 180, height: 180 }} />
            }
            description={t('充值功能暂未开放')}
          />
        </div>
      )}
    </main>
  );
};

export default Recharge;
