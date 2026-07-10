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
import { zodResolver } from '@hookform/resolvers/zod'
import { BookOpen, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { useUpdateOption } from '../hooks/use-update-option'
import { removeTrailingSlash } from './utils'

const lakalaSchema = z.object({
  LakalaEnabled: z.boolean(),
  LakalaSandbox: z.boolean(),
  LakalaAppId: z.string(),
  LakalaSerialNo: z.string(),
  LakalaPrivateKey: z.string(),
  LakalaPublicKey: z.string(),
  LakalaMerchantId: z.string(),
  LakalaTermNo: z.string(),
  LakalaPayMode: z.string(),
  LakalaTransType: z.string(),
  LakalaOrderSource: z.string(),
  LakalaNotifyUrl: z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    return /^https?:/ //.test(trimmed)
  }, 'Provide a valid URL starting with http:// or https://'),
  LakalaReturnUrl: z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    return /^https?:/ //.test(trimmed)
  }, 'Provide a valid URL starting with http:// or https://'),
  LakalaUnitPrice: z.coerce.number().min(0),
  LakalaMinTopUp: z.coerce.number().min(0),
})

type LakalaSettingsInput = z.input<typeof lakalaSchema>
export type LakalaSettingsValues = z.output<typeof lakalaSchema>

type LakalaSettingsSectionProps = {
  defaultValues: LakalaSettingsValues
}

export function LakalaSettingsSection(props: LakalaSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<LakalaSettingsInput, unknown, LakalaSettingsValues>({
    resolver: zodResolver(lakalaSchema) as Resolver<
      LakalaSettingsInput,
      unknown,
      LakalaSettingsValues
    >,
    mode: 'onChange',
    defaultValues: props.defaultValues,
  })

  useEffect(() => {
    form.reset(props.defaultValues)
  }, [props.defaultValues, form])

  const onSubmit = async (values: LakalaSettingsValues) => {
    const sanitized = {
      LakalaEnabled: values.LakalaEnabled,
      LakalaSandbox: values.LakalaSandbox,
      LakalaAppId: values.LakalaAppId.trim(),
      LakalaSerialNo: values.LakalaSerialNo.trim(),
      LakalaPrivateKey: values.LakalaPrivateKey.trim(),
      LakalaPublicKey: values.LakalaPublicKey.trim(),
      LakalaMerchantId: values.LakalaMerchantId.trim(),
      LakalaTermNo: values.LakalaTermNo.trim(),
      LakalaPayMode: values.LakalaPayMode.trim() || 'ALIPAY',
      LakalaTransType: values.LakalaTransType.trim() || '41',
      LakalaOrderSource: values.LakalaOrderSource.trim(),
      LakalaNotifyUrl: removeTrailingSlash(values.LakalaNotifyUrl),
      LakalaReturnUrl: removeTrailingSlash(values.LakalaReturnUrl),
      LakalaUnitPrice: values.LakalaUnitPrice,
      LakalaMinTopUp: values.LakalaMinTopUp,
    }

    const updates: Array<{ key: string; value: string | number | boolean }> = [
      { key: 'LakalaEnabled', value: sanitized.LakalaEnabled },
      { key: 'LakalaSandbox', value: sanitized.LakalaSandbox },
      { key: 'LakalaAppId', value: sanitized.LakalaAppId },
      { key: 'LakalaSerialNo', value: sanitized.LakalaSerialNo },
      { key: 'LakalaPublicKey', value: sanitized.LakalaPublicKey },
      { key: 'LakalaMerchantId', value: sanitized.LakalaMerchantId },
      { key: 'LakalaTermNo', value: sanitized.LakalaTermNo },
      { key: 'LakalaPayMode', value: sanitized.LakalaPayMode },
      { key: 'LakalaTransType', value: sanitized.LakalaTransType },
      { key: 'LakalaOrderSource', value: sanitized.LakalaOrderSource },
      { key: 'LakalaNotifyUrl', value: sanitized.LakalaNotifyUrl },
      { key: 'LakalaReturnUrl', value: sanitized.LakalaReturnUrl },
      { key: 'LakalaUnitPrice', value: sanitized.LakalaUnitPrice },
      { key: 'LakalaMinTopUp', value: sanitized.LakalaMinTopUp },
    ]

    if (sanitized.LakalaPrivateKey) {
      updates.push({
        key: 'LakalaPrivateKey',
        value: sanitized.LakalaPrivateKey,
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-lg font-medium'>{t('Lakala Gateway')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t('Direct integration with Lakala Open Platform')}
        </p>
      </div>

      <Alert>
        <BookOpen className='h-4 w-4' />
        <AlertDescription>
          {t('Notify URL:')}{' '}
          <code className='bg-muted rounded px-1 py-0.5 text-xs'>
            {'<ServerAddress>/api/lakala/notify'}
          </code>
        </AlertDescription>
      </Alert>

      <Alert className='border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200'>
        <TriangleAlert className='h-4 w-4' />
        <AlertDescription>
          {t(
            'Use the Lakala merchant platform to configure merchant notification if your order source requires it.'
          )}
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
          data-no-autosubmit='true'
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='LakalaEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>{t('Enabled')}</FormLabel>
                    <FormDescription>
                      {t('Allow users to pay with Lakala')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='LakalaSandbox'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      {t('Sandbox mode')}
                    </FormLabel>
                    <FormDescription>
                      {t('Use the Lakala sandbox gateway')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-3'>
            <FormField
              control={form.control}
              name='LakalaAppId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('App ID')}</FormLabel>
                  <FormControl>
                    <Input placeholder='OP00000000000000' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Application ID from Lakala Open Platform')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='LakalaSerialNo'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Certificate serial number')}</FormLabel>
                  <FormControl>
                    <Input placeholder='1234567890ABCDEF' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Lakala application certificate serial number')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='LakalaMerchantId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Merchant ID')}</FormLabel>
                  <FormControl>
                    <Input placeholder='822xxxxxxxxxxxx' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Lakala merchant number')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-4'>
            <FormField
              control={form.control}
              name='LakalaTermNo'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Terminal number')}</FormLabel>
                  <FormControl>
                    <Input placeholder='29034705' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Lakala terminal number')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='LakalaPayMode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Pay mode')}</FormLabel>
                  <FormControl>
                    <NativeSelect
                      value={field.value || 'ALIPAY'}
                      onChange={(event) => field.onChange(event.target.value)}
                      className='w-full'
                    >
                      <NativeSelectOption value='ALIPAY'>
                        Alipay
                      </NativeSelectOption>
                      <NativeSelectOption value='WECHAT'>
                        WeChat
                      </NativeSelectOption>
                      <NativeSelectOption value='UQRCODEPAY'>
                        UQRCODEPAY
                      </NativeSelectOption>
                      <NativeSelectOption value='DCPAY'>
                        DCPAY
                      </NativeSelectOption>
                      <NativeSelectOption value='LKLACC'>
                        LKLACC
                      </NativeSelectOption>
                    </NativeSelect>
                  </FormControl>
                  <FormDescription>
                    {t('Payment channel used for Lakala pre-order')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='LakalaTransType'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Transaction type')}</FormLabel>
                  <FormControl>
                    <NativeSelect
                      value={field.value || '41'}
                      onChange={(event) => field.onChange(event.target.value)}
                      className='w-full'
                    >
                      <NativeSelectOption value='41'>
                        41 NATIVE
                      </NativeSelectOption>
                      <NativeSelectOption value='51'>
                        51 JSAPI
                      </NativeSelectOption>
                      <NativeSelectOption value='81'>
                        81 Alipay H5
                      </NativeSelectOption>
                    </NativeSelect>
                  </FormControl>
                  <FormDescription>
                    {t('Use 41 for QR code payments')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='LakalaOrderSource'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Order source')}</FormLabel>
                  <FormControl>
                    <Input placeholder='gateway' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Optional external order source used by Lakala notifications'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='LakalaNotifyUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Notify URL override')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://gateway.example.com/api/lakala/notify'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Leave blank to use the server address callback')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='LakalaReturnUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Return URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://gateway.example.com/console/topup?show_history=true'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Browser redirect after payment completion')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='LakalaUnitPrice'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Unit price (CNY / USD)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      step='0.01'
                      min={0}
                      value={(field.value ?? 0) as number}
                      onChange={(event) =>
                        field.onChange(event.target.valueAsNumber)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Amount charged per USD of balance')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='LakalaMinTopUp'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Minimum top-up (USD)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      step='1'
                      min={0}
                      value={(field.value ?? 0) as number}
                      onChange={(event) =>
                        field.onChange(event.target.valueAsNumber)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Minimum recharge amount in USD')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='LakalaPrivateKey'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Application private key')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={6}
                      placeholder={t('Enter new private key to update')}
                      autoComplete='new-password'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'RSA2 application private key, leave blank unless updating'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='LakalaPublicKey'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Lakala public key or certificate')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={6}
                      placeholder='MIIBIjANBgkq...'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Lakala public key or platform certificate used to verify responses and notifications'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending
              ? t('Saving...')
              : t('Save Lakala settings')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
