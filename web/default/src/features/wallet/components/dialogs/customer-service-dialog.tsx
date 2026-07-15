/*
Copyright (C) 2023-2026 QuantumNous

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
import { CustomerService02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function CustomerServiceDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        className='w-full gap-2 sm:w-auto'
        size='sm'
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={CustomerService02Icon} strokeWidth={2} />
        {t('Contact Customer Service')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
          <DialogHeader className='text-center sm:text-center'>
            <DialogTitle>{t('Contact Customer Service')}</DialogTitle>
            <DialogDescription>
              {t('Scan the QR code with WeChat to add customer service.')}
            </DialogDescription>
          </DialogHeader>
          <div className='mx-auto overflow-hidden rounded-lg border bg-white p-2'>
            <img
              src='/customer-service-wechat.jpg'
              alt={t('Customer service WeChat QR code')}
              width={912}
              height={1354}
              loading='lazy'
              decoding='async'
              className='max-h-[62vh] w-full max-w-[360px] object-contain'
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
