import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Account,
  AppState,
  CalendarEvent,
  DailyReview,
  Note,
  PositionMeta,
  Quote,
  Settings,
  TCalculationRecord,
  Trade,
  WatchItem,
  WeeklyReview,
} from '../types'
import { buildAnalytics, buildPositions, buildTotals } from '../lib/calc'
import { INDEX_SYMBOLS, fetchQuotes } from '../lib/quotes'
import { todayStr } from '../lib/dates'
import { uid } from '../lib/id'
import { clearServerState, fetchDataInfo, loadServerState, saveServerState } from '../lib/api'
import { createDemoState, createEmptyState } from './seed'
import { buildBackup, clearLegacyState, loadLegacyState, normalizeState } from './storage'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AppStore {
  state: AppState
  hydrated: boolean
  loadError: string
  saveStatus: SaveStatus
  saveError: string
  lastSavedAt: number | null
  dataPath: string
  migrationNotice: boolean
  retryHydrate: () => void
  clearMigrationNotice: () => void
  positions: ReturnType<typeof buildPositions>
  totals: ReturnType<typeof buildTotals>
  analytics: ReturnType<typeof buildAnalytics>
  quoteBusy: boolean
  quoteError: string
  lastQuoteAt: number | null
  refreshQuotes: (symbols?: string[]) => Promise<{ ok: boolean; count: number; error?: string }>
  addTrade: (trade: Omit<Trade, 'id' | 'createdAt'>) => string
  updateTrade: (id: string, trade: Partial<Trade>) => void
  deleteTrade: (id: string) => void
  setCurrentAccount: (id: string | 'all') => void
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => string
  updateAccount: (id: string, patch: Partial<Account>) => void
  deleteAccount: (id: string) => void
  saveReview: (review: DailyReview) => void
  deleteReview: (date: string) => void
  saveWeeklyReview: (review: WeeklyReview) => void
  deleteWeeklyReview: (weekStart: string) => void
  updatePositionMeta: (key: string, meta: PositionMeta) => void
  addWatch: (item: Omit<WatchItem, 'id' | 'addedAt'>) => void
  updateWatch: (id: string, patch: Partial<WatchItem>) => void
  deleteWatch: (id: string) => void
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateNote: (id: string, patch: Partial<Note>) => void
  deleteNote: (id: string) => void
  addTCalculation: (record: Omit<TCalculationRecord, 'id' | 'createdAt'>) => void
  deleteTCalculation: (id: string) => void
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => void
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  setQuote: (quote: Quote) => void
  setManualPrice: (symbol: string, price: number) => void
  captureSnapshot: () => void
  updateSettings: (patch: Partial<Settings>) => void
  completeOnboarding: (
    account: { name: string; broker?: string; initialCapital: number; cash: number },
    fees?: Pick<Settings, 'commissionRate' | 'minCommission' | 'stampTaxRate' | 'transferFeeRate'>,
  ) => void
  loadDemo: () => void
  resetAll: () => Promise<boolean>
  importData: (data: unknown) => void
  exportBackup: () => string
  dismissDemo: () => void
}

const StoreContext = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(createEmptyState)
  const [hydrated, setHydrated] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [hydrateNonce, setHydrateNonce] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [dataPath, setDataPath] = useState('')
  const [migrationNotice, setMigrationNotice] = useState(false)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [lastQuoteAt, setLastQuoteAt] = useState<number | null>(null)
  const stateRef = useRef(state)
  const didAutoRefresh = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const saveChain = useRef(Promise.resolve())
  const saveSeq = useRef(0)

  useEffect(() => {
    let alive = true
    setHydrated(false)
    setLoadError('')
    ;(async () => {
      try {
        const remote = await loadServerState()
        if (!alive) return
        let next: AppState
        if (remote.state) {
          next = normalizeState(remote.state)
          setLastSavedAt(remote.savedAt ? Date.parse(remote.savedAt) : Date.now())
          setSaveStatus('saved')
        } else {
          const legacy = loadLegacyState()
          if (legacy) {
            next = normalizeState(legacy)
            await saveServerState(next)
            clearLegacyState()
            setMigrationNotice(true)
            setLastSavedAt(Date.now())
            setSaveStatus('saved')
          } else {
            next = createEmptyState()
            setSaveStatus('idle')
          }
        }
        if (!alive) return
        setState(next)
        stateRef.current = next
        setDataPath(remote.path || '')
        setHydrated(true)
        const info = await fetchDataInfo().catch(() => null)
        if (info && alive) setDataPath(info.path)
      } catch (error) {
        if (!alive) return
        setLoadError(error instanceof Error ? error.message : '无法读取本地数据文件')
      }
    })()
    return () => {
      alive = false
    }
  }, [hydrateNonce])

  useEffect(() => {
    stateRef.current = state
    if (!hydrated) return
    const snapshot = state
    setSaveStatus('saving')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      const seq = ++saveSeq.current
      saveChain.current = saveChain.current.then(async () => {
        try {
          const result = await saveServerState(snapshot)
          if (seq === saveSeq.current) {
            setSaveStatus('saved')
            setSaveError('')
            setLastSavedAt(Date.parse(result.savedAt) || Date.now())
            setDataPath(result.path)
          }
        } catch (error) {
          if (seq === saveSeq.current) {
            setSaveStatus('error')
            setSaveError(error instanceof Error ? error.message : '保存失败')
          }
        }
      })
    }, 450)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [state, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const flush = () => {
      try {
        void fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: stateRef.current }),
          keepalive: true,
        })
      } catch {
        // page is unloading; the next launch will load the last successful save
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [hydrated])

  const retryHydrate = useCallback(() => {
    setHydrateNonce((value) => value + 1)
  }, [])

  const clearMigrationNotice = useCallback(() => setMigrationNotice(false), [])

  const positions = useMemo(() => buildPositions(state), [state])
  const totals = useMemo(() => buildTotals(state, positions), [state, positions])
  const analytics = useMemo(() => buildAnalytics(state, positions), [state, positions])

  const refreshQuotes = useCallback(async (symbols?: string[]) => {
    const snapshot = stateRef.current
    if (snapshot.demoMode) {
      return { ok: false, count: 0, error: '示例数据使用固定行情；切换为我的数据后即可刷新实时行情' }
    }
    const activeSymbols =
      symbols && symbols.length > 0
        ? symbols
        : [
            ...INDEX_SYMBOLS,
            ...snapshot.watchlist.map((item) => item.symbol),
            ...snapshot.trades.map((trade) => trade.symbol),
          ]
    setQuoteBusy(true)
    setQuoteError('')
    try {
      const quotes = await fetchQuotes(activeSymbols)
      if (quotes.length === 0) throw new Error('没有获取到行情数据')
      const now = Date.now()
      setState((prev) => {
        const nextQuotes = { ...prev.quotes }
        for (const quote of quotes) nextQuotes[quote.symbol] = quote
        return { ...prev, quotes: nextQuotes }
      })
      setLastQuoteAt(now)
      return { ok: true, count: quotes.length }
    } catch (error) {
      const message = error instanceof Error ? error.message : '行情刷新失败'
      setQuoteError(message)
      return { ok: false, count: 0, error: message }
    } finally {
      setQuoteBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!state.onboarded || !state.settings.autoRefreshQuotes || state.demoMode || didAutoRefresh.current) return
    didAutoRefresh.current = true
    const timer = window.setTimeout(() => {
      void refreshQuotes()
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [state.onboarded, state.settings.autoRefreshQuotes, state.demoMode, refreshQuotes])

  const addTrade = useCallback((trade: Omit<Trade, 'id' | 'createdAt'>) => {
    const id = uid('trd')
    setState((prev) => {
      const cashDelta = trade.side === 'buy' ? -(trade.price * trade.quantity + trade.fee) : trade.price * trade.quantity - trade.fee
      return {
        ...prev,
        accounts: prev.accounts.map((account) =>
          account.id === trade.accountId
            ? { ...account, cash: Math.round((account.cash + cashDelta) * 100) / 100 }
            : account,
        ),
        trades: [...prev.trades, { ...trade, id, createdAt: Date.now() }],
      }
    })
    return id
  }, [])

  const updateTrade = useCallback((id: string, patch: Partial<Trade>) => {
    setState((prev) => {
      const original = prev.trades.find((trade) => trade.id === id)
      if (!original) return prev
      const updated = { ...original, ...patch, id: original.id, updatedAt: Date.now() }
      const cashEffect = (trade: Trade) =>
        trade.side === 'buy' ? -(trade.price * trade.quantity + trade.fee) : trade.price * trade.quantity - trade.fee
      let accounts = prev.accounts
      if (original.accountId === updated.accountId) {
        const delta = cashEffect(updated) - cashEffect(original)
        accounts = accounts.map((account) =>
          account.id === original.accountId
            ? { ...account, cash: Math.round((account.cash + delta) * 100) / 100 }
            : account,
        )
      } else {
        accounts = accounts.map((account) => {
          if (account.id === original.accountId) {
            return { ...account, cash: Math.round((account.cash - cashEffect(original)) * 100) / 100 }
          }
          if (account.id === updated.accountId) {
            return { ...account, cash: Math.round((account.cash + cashEffect(updated)) * 100) / 100 }
          }
          return account
        })
      }
      return {
        ...prev,
        accounts,
        trades: prev.trades.map((trade) => (trade.id === id ? updated : trade)),
      }
    })
  }, [])

  const deleteTrade = useCallback((id: string) => {
    setState((prev) => {
      const target = prev.trades.find((trade) => trade.id === id)
      if (!target) return prev
      const cashDelta =
        target.side === 'buy'
          ? target.price * target.quantity + target.fee
          : -(target.price * target.quantity - target.fee)
      return {
        ...prev,
        accounts: prev.accounts.map((account) =>
          account.id === target.accountId
            ? { ...account, cash: Math.round((account.cash + cashDelta) * 100) / 100 }
            : account,
        ),
        trades: prev.trades.filter((trade) => trade.id !== id),
      }
    })
  }, [])

  const setCurrentAccount = useCallback((id: string | 'all') => {
    setState((prev) => ({ ...prev, currentAccountId: id }))
  }, [])

  const addAccount = useCallback((account: Omit<Account, 'id' | 'createdAt'>) => {
    const id = uid('acc')
    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, { ...account, id, createdAt: Date.now() }],
    }))
    return id
  }, [])

  const updateAccount = useCallback((id: string, patch: Partial<Account>) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) => (account.id === id ? { ...account, ...patch } : account)),
    }))
  }, [])

  const deleteAccount = useCallback((id: string) => {
    setState((prev) => {
      if (prev.accounts.length <= 1) return prev
      const accounts = prev.accounts.filter((account) => account.id !== id)
      const positionMeta = Object.fromEntries(
        Object.entries(prev.positionMeta).filter(([key]) => !key.startsWith(`${id}:`)),
      )
      return {
        ...prev,
        accounts,
        trades: prev.trades.filter((trade) => trade.accountId !== id),
        positionMeta,
        currentAccountId: prev.currentAccountId === id ? accounts[0].id : prev.currentAccountId,
      }
    })
  }, [])

  const saveReview = useCallback((review: DailyReview) => {
    setState((prev) => {
      const exists = prev.reviews.some((item) => item.date === review.date)
      const reviews = exists
        ? prev.reviews.map((item) => (item.date === review.date ? review : item))
        : [...prev.reviews, review]
      return { ...prev, reviews }
    })
  }, [])

  const deleteReview = useCallback((date: string) => {
    setState((prev) => ({ ...prev, reviews: prev.reviews.filter((review) => review.date !== date) }))
  }, [])

  const saveWeeklyReview = useCallback((review: WeeklyReview) => {
    setState((prev) => {
      const exists = prev.weeklyReviews.some((item) => item.weekStart === review.weekStart)
      const weeklyReviews = exists
        ? prev.weeklyReviews.map((item) => (item.weekStart === review.weekStart ? review : item))
        : [...prev.weeklyReviews, review]
      return { ...prev, weeklyReviews }
    })
  }, [])

  const deleteWeeklyReview = useCallback((weekStart: string) => {
    setState((prev) => ({
      ...prev,
      weeklyReviews: prev.weeklyReviews.filter((review) => review.weekStart !== weekStart),
    }))
  }, [])

  const updatePositionMeta = useCallback((key: string, meta: PositionMeta) => {
    setState((prev) => ({ ...prev, positionMeta: { ...prev.positionMeta, [key]: meta } }))
  }, [])

  const addWatch = useCallback((item: Omit<WatchItem, 'id' | 'addedAt'>) => {
    setState((prev) => ({
      ...prev,
      watchlist: [...prev.watchlist, { ...item, id: uid('watch'), addedAt: Date.now() }],
    }))
  }, [])

  const updateWatch = useCallback((id: string, patch: Partial<WatchItem>) => {
    setState((prev) => ({
      ...prev,
      watchlist: prev.watchlist.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }, [])

  const deleteWatch = useCallback((id: string) => {
    setState((prev) => ({ ...prev, watchlist: prev.watchlist.filter((item) => item.id !== id) }))
  }, [])

  const addNote = useCallback((note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = uid('note')
    const now = Date.now()
    setState((prev) => ({
      ...prev,
      notes: [{ ...note, id, createdAt: now, updatedAt: now }, ...prev.notes],
    }))
    return id
  }, [])

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((note) =>
        note.id === id ? { ...note, ...patch, id: note.id, updatedAt: Date.now() } : note,
      ),
    }))
  }, [])

  const deleteNote = useCallback((id: string) => {
    setState((prev) => ({ ...prev, notes: prev.notes.filter((note) => note.id !== id) }))
  }, [])

  const addTCalculation = useCallback((record: Omit<TCalculationRecord, 'id' | 'createdAt'>) => {
    setState((prev) => ({
      ...prev,
      tHistory: [{ ...record, id: uid('tcalc'), createdAt: Date.now() }, ...prev.tHistory].slice(0, 50),
    }))
  }, [])

  const deleteTCalculation = useCallback((id: string) => {
    setState((prev) => ({ ...prev, tHistory: prev.tHistory.filter((item) => item.id !== id) }))
  }, [])

  const addEvent = useCallback((event: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    setState((prev) => ({
      ...prev,
      events: [...prev.events, { ...event, id: uid('evt'), createdAt: Date.now() }],
    }))
  }, [])

  const updateEvent = useCallback((id: string, patch: Partial<CalendarEvent>) => {
    setState((prev) => ({
      ...prev,
      events: prev.events.map((event) => (event.id === id ? { ...event, ...patch } : event)),
    }))
  }, [])

  const deleteEvent = useCallback((id: string) => {
    setState((prev) => ({ ...prev, events: prev.events.filter((event) => event.id !== id) }))
  }, [])

  const setQuote = useCallback((quote: Quote) => {
    setState((prev) => ({ ...prev, quotes: { ...prev.quotes, [quote.symbol]: quote } }))
  }, [])

  const setManualPrice = useCallback((symbol: string, price: number) => {
    setState((prev) => {
      const old = prev.quotes[symbol]
      const quote: Quote = {
        symbol,
        name: old?.name ?? symbol,
        price,
        prevClose: old?.price ?? price,
        open: old?.open ?? price,
        high: old?.high ?? price,
        low: old?.low ?? price,
        changePct: old?.price ? ((price - old.price) / old.price) * 100 : 0,
        updatedAt: Date.now(),
      }
      return { ...prev, quotes: { ...prev.quotes, [symbol]: quote } }
    })
  }, [])

  const captureSnapshot = useCallback(() => {
    setState((prev) => {
      const currentPositions = buildPositions(prev)
      const currentTotals = buildTotals(prev, currentPositions)
      const date = todayStr()
      const snapshot = {
        date,
        cash: currentTotals.cash,
        marketValue: currentTotals.marketValue,
        totalAssets: currentTotals.totalAssets,
        cost: currentTotals.cost,
        unrealized: currentTotals.unrealized,
        realized: currentTotals.realized,
        createdAt: Date.now(),
      }
      const exists = prev.snapshots.some((item) => item.date === date)
      const snapshots = exists
        ? prev.snapshots.map((item) => (item.date === date ? snapshot : item))
        : [...prev.snapshots, snapshot].sort((a, b) => (a.date < b.date ? -1 : 1))
      return { ...prev, snapshots }
    })
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))
  }, [])

  const completeOnboarding = useCallback(
    (
      account: { name: string; broker?: string; initialCapital: number; cash: number },
      fees?: Pick<Settings, 'commissionRate' | 'minCommission' | 'stampTaxRate' | 'transferFeeRate'>,
    ) => {
      setState((prev) => {
        const id = uid('acc')
        const created: Account = {
          id,
          name: account.name || '我的账户',
          broker: account.broker ?? '',
          color: '#2f6b4f',
          initialCapital: account.initialCapital,
          cash: account.cash,
          createdAt: Date.now(),
        }
        return {
          ...prev,
          onboarded: true,
          accounts: [created],
          currentAccountId: id,
          settings: fees ? { ...prev.settings, ...fees } : prev.settings,
        }
      })
    },
    [],
  )

  const loadDemo = useCallback(() => {
    setState(createDemoState())
  }, [])

  const resetAll = useCallback(async () => {
    try {
      await clearServerState()
      clearLegacyState()
      localStorage.removeItem('god-egg-t-history')
      setState(createEmptyState())
      setLastSavedAt(null)
      setSaveError('')
      setSaveStatus('idle')
      return true
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '清空本地文件失败')
      setSaveStatus('error')
      return false
    }
  }, [])

  const importData = useCallback((data: unknown) => {
    const next = normalizeState(data)
    setState(next)
  }, [])

  const exportBackup = useCallback(() => JSON.stringify(buildBackup(stateRef.current), null, 2), [])

  const dismissDemo = useCallback(() => {
    setState((prev) => ({ ...prev, demoMode: false }))
  }, [])

  const value: AppStore = {
    state,
    hydrated,
    loadError,
    saveStatus,
    saveError,
    lastSavedAt,
    dataPath,
    migrationNotice,
    retryHydrate,
    clearMigrationNotice,
    positions,
    totals,
    analytics,
    quoteBusy,
    quoteError,
    lastQuoteAt,
    refreshQuotes,
    addTrade,
    updateTrade,
    deleteTrade,
    setCurrentAccount,
    addAccount,
    updateAccount,
    deleteAccount,
    saveReview,
    deleteReview,
    saveWeeklyReview,
    deleteWeeklyReview,
    updatePositionMeta,
    addWatch,
    updateWatch,
    deleteWatch,
    addNote,
    updateNote,
    deleteNote,
    addTCalculation,
    deleteTCalculation,
    addEvent,
    updateEvent,
    deleteEvent,
    setQuote,
    setManualPrice,
    captureSnapshot,
    updateSettings,
    completeOnboarding,
    loadDemo,
    resetAll,
    importData,
    exportBackup,
    dismissDemo,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): AppStore {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used inside AppStoreProvider')
  return context
}
