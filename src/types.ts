export type ID = string

export type TradeSide = 'buy' | 'sell'

export interface Account {
  id: ID
  name: string
  broker: string
  color: string
  initialCapital: number
  cash: number
  createdAt: number
}

export interface Trade {
  id: ID
  accountId: ID
  symbol: string
  name: string
  side: TradeSide
  price: number
  quantity: number
  /** 实际发生的总费用（佣金 + 过户费 + 卖出印花税） */
  fee: number
  date: string // YYYY-MM-DD
  time: string // HH:mm
  reasonTags: string[]
  emotion: string
  note: string
  /** 仅买入批次使用：解禁日期 */
  unlockDate?: string
  /** 仅买入批次使用：批次标签，如“第一期激励” */
  batchLabel?: string
  createdAt: number
  updatedAt?: number
}

export interface PositionMeta {
  sector: string
  thesis: string
  stopLoss?: number
  targetPrice?: number
  tags: string[]
  updatedAt: number
}

export interface WatchItem {
  id: ID
  symbol: string
  name: string
  targetPrice?: number
  stopLoss?: number
  thesis: string
  tags: string[]
  addedAt: number
}

export type MarketMood = 'bullish' | 'neutral' | 'bearish'

export interface ReviewIndex {
  name: string
  code: string
  close: number
  changePct: number
}

export interface DailyReview {
  id: ID
  date: string
  mood: MarketMood
  indices: ReviewIndex[]
  marketNote: string
  whatWorked: string
  whatFailed: string
  lessons: string
  emotionalState: string
  nextPlan: string
  disciplineScore: number
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface WeeklyReview {
  id: ID
  weekStart: string
  summary: string
  marketReview: string
  mistakes: string
  nextWeekPlan: string
  disciplineScore: number
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type EventType = 'review' | 'trade' | 'earnings' | 'unlock' | 'macro' | 'custom'

export interface CalendarEvent {
  id: ID
  date: string
  time?: string
  title: string
  type: EventType
  symbol?: string
  note?: string
  createdAt: number
}

export interface Quote {
  symbol: string
  name: string
  price: number
  prevClose: number
  open: number
  high: number
  low: number
  changePct: number
  updatedAt: number
}

export interface Snapshot {
  date: string
  cash: number
  marketValue: number
  totalAssets: number
  cost: number
  unrealized: number
  realized: number
  createdAt: number
}

export interface AiSettings {
  endpoint: string
  apiKey: string
  model: string
}

export interface Settings {
  commissionRate: number
  minCommission: number
  stampTaxRate: number
  transferFeeRate: number
  autoRefreshQuotes: boolean
  ai: AiSettings
}

export interface Note {
  id: ID
  title: string
  content: string
  tags: string[]
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export interface TCalculationRecord {
  id: ID
  buyPrice: number
  sellPrice: number
  quantity: number
  netProfit: number
  netRate: number
  createdAt: number
}

export interface AppState {
  version: number
  onboarded: boolean
  demoMode: boolean
  currentAccountId: ID | 'all'
  accounts: Account[]
  trades: Trade[]
  positionMeta: Record<string, PositionMeta>
  watchlist: WatchItem[]
  reviews: DailyReview[]
  weeklyReviews: WeeklyReview[]
  notes: Note[]
  tHistory: TCalculationRecord[]
  events: CalendarEvent[]
  snapshots: Snapshot[]
  quotes: Record<string, Quote>
  settings: Settings
}

export interface LotView {
  id: ID
  tradeId: ID
  buyDate: string
  unlockDate?: string
  batchLabel?: string
  quantity: number
  remaining: number
  costPrice: number
  totalCost: number
  monthsHeld: number
}

export interface SellView {
  trade: Trade
  quantity: number
  costBasis: number
  proceeds: number
  realized: number
  realizedPct: number
  holdingDays: number
}

export interface PositionView {
  key: string
  accountId: ID
  accountName: string
  symbol: string
  name: string
  sector: string
  quantity: number
  costPrice: number
  totalCost: number
  price: number
  prevClose: number
  marketValue: number
  unrealized: number
  unrealizedPct: number
  realized: number
  dayPnl: number
  dayPnlPct: number
  lots: LotView[]
  sells: SellView[]
  trades: Trade[]
  lastTradeDate: string
  meta?: PositionMeta
  quoteUpdatedAt?: number
}

export interface PortfolioTotals {
  marketValue: number
  cost: number
  unrealized: number
  unrealizedPct: number
  realized: number
  totalPnl: number
  cash: number
  totalAssets: number
  dayPnl: number
  positionCount: number
  tradeCount: number
}

export interface Analytics {
  winRate: number
  wins: number
  losses: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  totalRealized: number
  avgHoldingDays: number
  trades: number
  fees: number
  monthly: { month: string; label: string; realized: number; trades: number }[]
  byReason: { tag: string; count: number; realized: number; winRate: number }[]
  byEmotion: { emotion: string; count: number; realized: number; winRate: number }[]
  topWinners: { symbol: string; name: string; realized: number }[]
  topLosers: { symbol: string; name: string; realized: number }[]
}
