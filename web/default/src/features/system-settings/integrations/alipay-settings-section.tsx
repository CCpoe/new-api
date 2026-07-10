import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { useUpdateOption } from '../hooks/use-update-option'
import { removeTrailingSlash } from './utils'

const alipaySchema = z.object({
  AlipayEnabled: z.boolean(),
  AlipaySandbox: z.boolean(),
  AlipayAppId: z.string(),
  AlipayPrivateKey: z.string(),
  AlipayPublicKey: z.string(),
  AlipayNotifyUrl: z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    return /^https?:\/\//.test(trimmed)
  }, 'Provide a valid URL starting with http:// or https://'),
  AlipayReturnUrl: z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    return /^https?:\/\//.test(trimmed)
  }, 'Provide a valid URL starting with http:// or https://'),
  AlipayUnitPrice: z.coerce.number().min(0),
  AlipayMinTopUp: z.coerce.number().min(0),
})

type AlipaySettingsInput = z.input<typeof alipaySchema>
export type AlipaySettingsValues = z.output<typeof alipaySchema>

type AlipaySettingsSectionProps = {
  defaultValues: AlipaySettingsValues
}

export function AlipaySettingsSection({
  defaultValues,
}: AlipaySettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<AlipaySettingsInput, unknown, AlipaySettingsValues>({
    resolver: zodResolver(alipaySchema) as Resolver<
      AlipaySettingsInput,
      unknown,
      AlipaySettingsValues
    >,
    mode: 'onChange',
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const onSubmit = async (values: AlipaySettingsValues) => {
    const sanitized = {
      AlipayEnabled: values.AlipayEnabled,
      AlipaySandbox: values.AlipaySandbox,
      AlipayAppId: values.AlipayAppId.trim(),
      AlipayPrivateKey: values.AlipayPrivateKey.trim(),
      AlipayPublicKey: values.AlipayPublicKey.trim(),
      AlipayNotifyUrl: removeTrailingSlash(values.AlipayNotifyUrl),
      AlipayReturnUrl: values.AlipayReturnUrl.trim(),
      AlipayUnitPrice: values.AlipayUnitPrice,
      AlipayMinTopUp: values.AlipayMinTopUp,
    }

    const updates: Array<{ key: string; value: string | number | boolean }> = [
      { key: 'AlipayEnabled', value: sanitized.AlipayEnabled },
      { key: 'AlipaySandbox', value: sanitized.AlipaySandbox },
      { key: 'AlipayAppId', value: sanitized.AlipayAppId },
      { key: 'AlipayPublicKey', value: sanitized.AlipayPublicKey },
      { key: 'AlipayNotifyUrl', value: sanitized.AlipayNotifyUrl },
      { key: 'AlipayReturnUrl', value: sanitized.AlipayReturnUrl },
      { key: 'AlipayUnitPrice', value: sanitized.AlipayUnitPrice },
      { key: 'AlipayMinTopUp', value: sanitized.AlipayMinTopUp },
    ]

    if (sanitized.AlipayPrivateKey) {
      updates.push({
        key: 'AlipayPrivateKey',
        value: sanitized.AlipayPrivateKey,
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-lg font-medium'>{t('Alipay Official Gateway')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t('Direct integration with Alipay Open Platform')}
        </p>
      </div>

      <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
        <p className='mb-2 font-medium'>{t('Webhook Configuration:')}</p>
        <ul className='list-inside list-disc space-y-1'>
          <li>
            {t('Notify URL:')}{' '}
            <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
              {'<ServerAddress>/api/alipay/notify'}
            </code>
          </li>
          <li>{t('Use RSA2 signing in the Alipay Open Platform console')}</li>
        </ul>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
          data-no-autosubmit='true'
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='AlipayEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>{t('Enabled')}</FormLabel>
                    <FormDescription>
                      {t('Allow users to pay with official Alipay')}
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
              name='AlipaySandbox'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      {t('Sandbox mode')}
                    </FormLabel>
                    <FormDescription>
                      {t('Use the Alipay sandbox gateway')}
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
              name='AlipayAppId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('App ID')}</FormLabel>
                  <FormControl>
                    <Input placeholder='2021000000000000' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Application ID from Alipay Open Platform')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='AlipayUnitPrice'
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
              name='AlipayMinTopUp'
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
              name='AlipayNotifyUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Notify URL override')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://gateway.example.com/api/alipay/notify'
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
              name='AlipayReturnUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Return URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://gateway.example.com/console/log'
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
              name='AlipayPrivateKey'
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
              name='AlipayPublicKey'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Alipay public key')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={6}
                      placeholder='MIIBIjANBgkq...'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Alipay public key used to verify async notifications')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending
              ? t('Saving...')
              : t('Save Alipay settings')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
