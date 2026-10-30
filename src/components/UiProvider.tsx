import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Trade } from '../types'
import { uid } from '../lib/id'
import { ToastStack } from './ui'
import { TradeModal, type TradeDraft } from './TradeModal'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface UiContextValue {
  toast: (message: string, tone?: ToastTone) => void
  openTrade: (options?: { trade?: Trade; preset?: Partial<Trade> }) => void
  closeTrade: () => void
}

const UiContext = createContext<UiContextValue | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [tradeDraft, setTradeDraft] = useState<TradeDraft | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = uid('toast')
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }])
      const timer = window.setTimeout(() => dismiss(id), 3600)
      timers.current.push(timer)
    },
    [dismiss],
  )

  const openTrade = useCallback((options?: { trade?: Trade; preset?: Partial<Trade> }) => {
    setTradeDraft(options ?? {})
  }, [])

  const closeTrade = useCallback(() => setTradeDraft(null), [])

  return (
    <UiContext.Provider value={{ toast, openTrade, closeTrade }}>
      {children}
      <TradeModal draft={tradeDraft} onClose={closeTrade} />
      <ToastStack items={toasts} onDismiss={dismiss} />
    </UiContext.Provider>
  )
}

export function useUi(): UiContextValue {
  const context = useContext(UiContext)
  if (!context) throw new Error('useUi must be used inside UiProvider')
  return context
}
