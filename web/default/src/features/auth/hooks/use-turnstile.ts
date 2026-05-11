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
import { useCallback, useState } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useStatus } from '@/hooks/use-status'

type TurnstileStatus = 'idle' | 'verified' | 'expired' | 'error'

/**
 * Hook for managing Turnstile verification
 */
export function useTurnstile() {
  const { status } = useStatus()
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>('idle')

  const isTurnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''
  const isTurnstileReady = !isTurnstileEnabled || Boolean(turnstileToken)

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token)
    setTurnstileStatus('verified')
  }, [])

  const resetTurnstile = useCallback((nextStatus: TurnstileStatus = 'idle') => {
    setTurnstileToken('')
    setTurnstileStatus(nextStatus)
  }, [])

  const handleTurnstileExpire = useCallback(() => {
    resetTurnstile('expired')
  }, [resetTurnstile])

  const handleTurnstileError = useCallback(() => {
    resetTurnstile('error')
  }, [resetTurnstile])

  /**
   * Validate if turnstile is ready when required
   */
  const validateTurnstile = (): boolean => {
    if (isTurnstileEnabled && !turnstileToken) {
      toast.info(
        i18next.t('Please complete the human verification first')
      )
      return false
    }
    return true
  }

  return {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    turnstileStatus,
    isTurnstileReady,
    setTurnstileToken,
    handleTurnstileVerify,
    handleTurnstileExpire,
    handleTurnstileError,
    resetTurnstile,
    validateTurnstile,
  }
}
