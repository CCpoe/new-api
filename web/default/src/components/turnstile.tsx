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
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  className?: string
}

export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  onError,
  className,
}: TurnstileProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    const animationFrame = window.requestAnimationFrame(() => {
      if (!cancelled) setVisible(true)
    })

    const render = () => {
      if (!ref.current || !window.turnstile || cancelled) return

      try {
        ref.current.innerHTML = ''
        window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            onVerify(token)
          },
          'error-callback': () => {
            onError?.()
            onExpire?.()
          },
          'expired-callback': () => {
            onExpire?.()
          },
        })
      } catch {
        onError?.()
      }
    }

    if (window.turnstile) {
      render()
      return () => {
        cancelled = true
        window.cancelAnimationFrame(animationFrame)
      }
    }

    const scriptId = 'cf-turnstile'
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', render, { once: true })
      return () => {
        cancelled = true
        window.cancelAnimationFrame(animationFrame)
        existingScript.removeEventListener('load', render)
      }
    }

    const s = document.createElement('script')
    s.id = scriptId
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => render()
    s.onerror = () => {
      onError?.()
    }
    document.head.appendChild(s)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(animationFrame)
    }
  }, [siteKey, onVerify, onExpire, onError])

  return (
    <div
      className={cn(
        'overflow-hidden transition-[max-height,opacity,transform,margin] duration-300 ease-out motion-reduce:transition-none',
        visible
          ? 'mt-2 max-h-[90px] translate-y-0 opacity-100'
          : 'mt-0 max-h-0 -translate-y-1 opacity-0',
        className
      )}
    >
      <div className='flex justify-center py-1'>
        <div className='w-[300px] max-w-full overflow-hidden rounded bg-background'>
          <div ref={ref} />
        </div>
      </div>
    </div>
  )
}
