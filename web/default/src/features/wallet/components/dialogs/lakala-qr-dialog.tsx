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
import { Check, Copy, ExternalLink, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import type { LakalaPaymentData } from '../../types'

type LakalaQrDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentData: LakalaPaymentData | null
}

export function LakalaQrDialog(props: LakalaQrDialogProps) {
  const { t } = useTranslation()
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: true })
  const qrValue =
    props.paymentData?.qr_code || props.paymentData?.pay_link || ''
  const orderId = props.paymentData?.order_id || ''
  const redirectUrl = props.paymentData?.redirect_url || ''
  const formData = props.paymentData?.form_data || ''
  const canOpenPaymentPage = Boolean(redirectUrl || formData)

  const openPaymentPage = () => {
    if (redirectUrl) {
      window.open(redirectUrl, '_blank')
      return
    }

    if (!formData) return

    const paymentWindow = window.open('', '_blank')
    if (!paymentWindow) return

    paymentWindow.document.open()
    paymentWindow.document.write(
      '<!doctype html><html><head><title>Lakala</title></head><body>' +
        formData +
        '<script>document.forms[0]?.submit()</script></body></html>'
    )
    paymentWindow.document.close()
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <QrCode className='h-5 w-5' />
            {qrValue ? t('Scan to Pay') : t('Open payment page')}
          </DialogTitle>
          <DialogDescription>
            {qrValue
              ? t('Use Alipay or the selected Lakala channel to scan this code')
              : t('Continue to the Lakala payment page')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col items-center gap-4 py-2'>
          {qrValue ? (
            <div className='bg-background rounded-lg border p-4'>
              <QRCodeSVG value={qrValue} size={220} level='M' includeMargin />
            </div>
          ) : (
            <div className='text-muted-foreground flex h-56 w-56 items-center justify-center rounded-lg border text-center text-sm'>
              {t('Payment QR code is not available')}
            </div>
          )}

          {orderId ? (
            <div className='bg-muted/40 flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2'>
              <code className='truncate text-xs'>{orderId}</code>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 shrink-0 gap-1.5 px-2'
                onClick={() => copyToClipboard(orderId)}
              >
                {copiedText === orderId ? (
                  <Check className='h-3.5 w-3.5' />
                ) : (
                  <Copy className='h-3.5 w-3.5' />
                )}
                {t('Copy')}
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
          {qrValue ? (
            <Button
              type='button'
              variant='outline'
              onClick={() => copyToClipboard(qrValue)}
            >
              <Copy className='mr-2 h-4 w-4' />
              {t('Copy code')}
            </Button>
          ) : null}
          {canOpenPaymentPage ? (
            <Button type='button' onClick={openPaymentPage}>
              <ExternalLink className='mr-2 h-4 w-4' />
              {t('Open')}
            </Button>
          ) : (
            <Button type='button' onClick={() => props.onOpenChange(false)}>
              {t('Done')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
