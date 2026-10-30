import type { AppState, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { createEmptyState } from './seed'

const LEGACY_STORAGE_KEY = 'golden-egg-state-v1'

function cloneSettings(settings?: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
    ai: {
      ...DEFAULT_SETTINGS.ai,
      ...(settings?.ai ?? {}),
    },
  }
}

export function normalizeState(input: unknown): AppState {
  if (!input || typeof input !== 'object') {
    throw new Error('备份文件格式不正确')
  }
  const raw = input as Partial<AppState> & { state?: Partial<AppState> }
  const candidate = raw.state ?? raw
  if (!Array.isArray(candidate.accounts) || candidate.accounts.length === 0) {
    throw new Error('备份中缺少账户数据')
  }
  const base = createEmptyState()
  const accounts = candidate.accounts
    .filter((account) => account && typeof account.id === 'string' && typeof account.name === 'string')
    .map((account) => ({
      ...base.accounts[0],
      ...account,
      initialCapital: Number(account.initialCapital) || 0,
      cash: Number(account.cash) || 0,
    }))
  if (accounts.length === 0) throw new Error('备份中的账户数据无效')

  const accountIds = new Set(accounts.map((account) => account.id))
  const state: AppState = {
    version: 1,
    onboarded: candidate.onboarded !== false,
    demoMode: Boolean(candidate.demoMode),
    currentAccountId:
      candidate.currentAccountId === 'all' || (candidate.currentAccountId && accountIds.has(candidate.currentAccountId))
        ? candidate.currentAccountId
        : accounts[0].id,
    accounts,
    trades: Array.isArray(candidate.trades)
      ? candidate.trades
          .filter((trade) => trade && accountIds.has(trade.accountId) && typeof trade.symbol === 'string')
          .map((trade) => ({
            ...trade,
            price: Number(trade.price) || 0,
            quantity: Number(trade.quantity) || 0,
            fee: Number(trade.fee) || 0,
            reasonTags: Array.isArray(trade.reasonTags) ? trade.reasonTags : [],
            emotion: trade.emotion || '中性',
            note: trade.note || '',
          }))
      : [],
    positionMeta: candidate.positionMeta && typeof candidate.positionMeta === 'object' ? candidate.positionMeta : {},
    watchlist: Array.isArray(candidate.watchlist) ? candidate.watchlist : [],
    reviews: Array.isArray(candidate.reviews)
      ? candidate.reviews.map((review) => ({
          ...review,
          indices: Array.isArray(review.indices) ? review.indices : [],
          tags: Array.isArray(review.tags) ? review.tags : [],
          disciplineScore: Number(review.disciplineScore) || 3,
        }))
      : [],
    weeklyReviews: Array.isArray(candidate.weeklyReviews) ? candidate.weeklyReviews : [],
    notes: Array.isArray(candidate.notes)
      ? candidate.notes.map((note) => ({
          ...note,
          tags: Array.isArray(note.tags) ? note.tags : [],
          content: note.content || '',
          title: note.title || '未命名笔记',
          pinned: Boolean(note.pinned),
        }))
      : [],
    tHistory: Array.isArray(candidate.tHistory) ? candidate.tHistory : [],
    events: Array.isArray(candidate.events) ? candidate.events : [],
    snapshots: Array.isArray(candidate.snapshots) ? candidate.snapshots : [],
    quotes: candidate.quotes && typeof candidate.quotes === 'object' ? candidate.quotes : {},
    settings: cloneSettings(candidate.settings),
  }
  return state
}

/** 仅用于把旧版本浏览器存储一次性迁移到 Node 数据文件。 */
export function loadLegacyState(): AppState | null {
  try {
    const text = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!text) return null
    return normalizeState(JSON.parse(text))
  } catch (error) {
    console.error('读取旧版浏览器数据失败', error)
    return null
  }
}

export function clearLegacyState(): void {
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

export function buildBackup(state: AppState) {
  const safe = structuredClone(state)
  safe.settings.ai.apiKey = ''
  return {
    app: 'GodenEgg',
    format: 'god-en-egg-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    state: safe,
  }
}
