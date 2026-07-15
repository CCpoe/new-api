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
import { ExternalLink, ImageOff, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const WORKBENCH_URL = '/image/?integration=kkcode'
const IFRAME_LOAD_TIMEOUT_MS = 20_000

export function ImageGeneration() {
  const { t } = useTranslation()
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeStatus, setIframeStatus] = useState<
    'loading' | 'ready' | 'error' | 'timeout'
  >('loading')

  useEffect(() => {
    setIframeStatus('loading')
    const timeoutId = window.setTimeout(() => {
      setIframeStatus((currentStatus) =>
        currentStatus === 'loading' ? 'timeout' : currentStatus
      )
    }, IFRAME_LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [iframeKey])

  const reloadIframe = () => {
    setIframeStatus('loading')
    setIframeKey((currentKey) => currentKey + 1)
  }

  const hasLoadError = iframeStatus === 'error' || iframeStatus === 'timeout'

  return (
    <section className='bg-background flex size-full min-h-0 flex-col overflow-hidden'>
      <header className='flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-4'>
        <h1 className='truncate text-base font-semibold'>
          {t('Image Generation')}
        </h1>
        <div className='flex shrink-0 items-center gap-1'>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={t('Retry')}
            title={t('Retry')}
            onClick={reloadIframe}
          >
            <RefreshCw aria-hidden='true' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() =>
              window.open(WORKBENCH_URL, '_blank', 'noopener,noreferrer')
            }
          >
            <ExternalLink aria-hidden='true' />
            <span className='hidden sm:inline'>{t('Open in new window')}</span>
          </Button>
        </div>
      </header>

      <div className='relative min-h-0 flex-1 overflow-hidden'>
        {/* oxlint-disable-next-line react/iframe-missing-sandbox -- The trusted same-origin workbench requires the current user's cookies and local storage. */}
        <iframe
          key={iframeKey}
          title={t('Image Generation')}
          src={WORKBENCH_URL}
          className='bg-background size-full border-0'
          allow='clipboard-read; clipboard-write'
          onLoad={() => setIframeStatus('ready')}
          onError={() => setIframeStatus('error')}
        />

        {iframeStatus === 'loading' && (
          <div className='bg-background absolute inset-0 flex flex-col items-center justify-center gap-3'>
            <Spinner className='size-6' />
            <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
          </div>
        )}

        {hasLoadError && (
          <div className='bg-background absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center'>
            <div className='bg-muted flex size-14 items-center justify-center rounded-full'>
              <ImageOff className='text-muted-foreground size-6' />
            </div>
            <p className='text-muted-foreground text-sm'>
              {t('Loading failed')}
            </p>
            <Button size='sm' onClick={reloadIframe}>
              <RefreshCw aria-hidden='true' />
              {t('Retry')}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
