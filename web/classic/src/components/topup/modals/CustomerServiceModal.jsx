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
import { Button, Modal, Typography } from '@douyinfe/semi-ui';
import { MessageCircle } from 'lucide-react';

const { Text } = Typography;

const CustomerServiceModal = ({ t }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className='w-full sm:w-auto'
        icon={<MessageCircle size={16} />}
        theme='solid'
        type='primary'
        onClick={() => setOpen(true)}
      >
        {t('联系客服')}
      </Button>
      <Modal
        title={
          <div className='flex items-center gap-2'>
            <MessageCircle size={18} />
            {t('联系客服')}
          </div>
        }
        visible={open}
        footer={null}
        centered
        width={420}
        onCancel={() => setOpen(false)}
      >
        <div className='flex flex-col items-center gap-3 text-center'>
          <div className='overflow-hidden rounded-lg border border-semi-color-border bg-white p-2'>
            <img
              src='/customer-service-wechat.jpg'
              alt={t('客服微信二维码')}
              width={912}
              height={1354}
              loading='lazy'
              decoding='async'
              className='max-h-[62vh] w-full max-w-[360px] object-contain'
            />
          </div>
          <Text type='tertiary'>{t('请使用微信扫描二维码添加客服。')}</Text>
        </div>
      </Modal>
    </>
  );
};

export default CustomerServiceModal;
