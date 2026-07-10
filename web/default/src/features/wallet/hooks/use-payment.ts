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
import i18next from 'i18next'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import {
  calculateAmount,
  calculateAlipayAmount,
  calculateLakalaAmount,
  calculateStripeAmount,
  calculateWaffoPancakeAmount,
  requestPayment,
  requestAlipayPayment,
  requestLakalaPayment,
  requestStripePayment,
  isApiSuccess,
} from '../api'
import {
  isAlipayOfficialPayment,
  isLakalaPayment,
  isStripePayment,
  isWaffoPancakePayment,
  submitPaymentForm,
} from '../lib'
import type { LakalaPaymentData } from '../types'

// ============================================================================
// Payment Hook
// ============================================================================

export function usePayment() {
  const [amount, setAmount] = useState<number>(0)
  const [calculating, setCalculating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [lakalaPaymentData, setLakalaPaymentData] =
    useState<LakalaPaymentData | null>(null)

  // Calculate payment amount
  const calculatePaymentAmount = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setCalculating(true)

        const isStripe = isStripePayment(paymentType)
        const isAlipayOfficial = isAlipayOfficialPayment(paymentType)
        const isLakala = isLakalaPayment(paymentType)
        const isPancake = isWaffoPancakePayment(paymentType)
        const response = await (async () => {
          if (isStripe) {
            return calculateStripeAmount({ amount: topupAmount })
          }
          if (isAlipayOfficial) {
            return calculateAlipayAmount({ amount: topupAmount })
          }
          if (isLakala) {
            return calculateLakalaAmount({ amount: topupAmount })
          }
          if (isPancake) {
            return calculateWaffoPancakeAmount({ amount: topupAmount })
          }
          return calculateAmount({ amount: topupAmount })
        })()

        if (isApiSuccess(response) && response.data) {
          const calculatedAmount = parseFloat(response.data)
          setAmount(calculatedAmount)
          return calculatedAmount
        }

        // Don't show error for calculation, just set to 0
        setAmount(0)
        return 0
      } catch (_error) {
        setAmount(0)
        return 0
      } finally {
        setCalculating(false)
      }
    },
    []
  )

  // Process payment
  const processPayment = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setProcessing(true)

        const isStripe = isStripePayment(paymentType)
        const isAlipayOfficial = isAlipayOfficialPayment(paymentType)
        const isLakala = isLakalaPayment(paymentType)
        const amount = Math.floor(topupAmount)
        setLakalaPaymentData(null)

        const response = await (async () => {
          if (isStripe) {
            return requestStripePayment({
              amount,
              payment_method: 'stripe',
            })
          }
          if (isAlipayOfficial) {
            return requestAlipayPayment({
              amount,
              payment_method: paymentType,
            })
          }
          if (isLakala) {
            return requestLakalaPayment({
              amount,
              payment_method: paymentType,
            })
          }
          return requestPayment({
            amount,
            payment_method: paymentType,
          })
        })()

        if (!isApiSuccess(response)) {
          toast.error(response.message || i18next.t('Payment request failed'))
          return false
        }

        // Handle Stripe payment
        if (isStripe && response.data?.pay_link) {
          window.open(response.data.pay_link as string, '_blank')
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        // Handle official Alipay payment
        if (isAlipayOfficial && response.data?.pay_link) {
          window.open(response.data.pay_link as string, '_blank')
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        // Handle Lakala payment
        if (isLakala && response.data) {
          setLakalaPaymentData(response.data as LakalaPaymentData)
          toast.success(i18next.t('Payment request created'))
          return true
        }

        // Handle non-Stripe payment
        if (!isStripe && !isAlipayOfficial && !isLakala && response.data) {
          const url = (response as unknown as { url?: string }).url
          if (url) {
            submitPaymentForm(url, response.data as Record<string, unknown>)
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        return false
      } catch (_error) {
        toast.error(i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  return {
    amount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
    lakalaPaymentData,
    clearLakalaPaymentData: () => setLakalaPaymentData(null),
    setAmount,
  }
}
