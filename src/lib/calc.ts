import type {
  Account,
  Analytics,
  AppState,
  LotView,
  PortfolioTotals,
  PositionView,
  SellView,
  Settings,
  Trade,
} from '../types'
import { daysBetween, monthKey, monthShort, todayStr } from './dates'
import { isTradingDay } from './tradingCalendar'
import { round2 } from './format'

export function calcFees(side: 'buy' | 'sell', price: number, quantity: number, settings: Settings): number {
  const amount = Math.max(0, price * quantity)
  if (amount <= 0) return 0
  const commission = Math.max(amount * settings.commissionRate, settings.minCommission)
  const transfer = amount * settings.transferFeeRate
  const stamp = side === 'sell' ? amount * settings.stampTaxRate : 0
  return round2(commission + transfer + stamp)
}

export function feeBreakdown(side: 'buy' | 'sell', price: number, quantity: number, settings: Settings) {
  const amount = Math.max(0, price * quantity)
  const commission = amount > 0 ? Math.max(amount * settings.commissionRate, settings.minCommission) : 0
  const transfer = amount * settings.transferFeeRate
  const stamp = side === 'sell' ? amount * settings.stampTaxRate : 0
  return {
    amount: round2(amount),
    commission: round2(commission),
    transfer: round2(transfer),
    stamp: round2(stamp),
    total: round2(commission + transfer + stamp),
  }
}

export function breakEvenSellPrice(buyPrice: number, quantity: number, settings: Settings): number {
  if (buyPrice <= 0 || quantity <= 0) return 0
  const buyFee = calcFees('buy', buyPrice, quantity, settings)
  const target = buyPrice * quantity + buyFee
  let price = buyPrice
  for (let i = 0; i < 8; i += 1) {
    const sellFee = calcFees('sell', price, quantity, settings)
    price = (target + sellFee) / quantity
  }
  return round2(price)
}

export interface TCalculation {
  buyAmount: number
  sellAmount: number
  buyFee: number
  sellFee: number
  grossProfit: number
  netProfit: number
  netRate: number
  breakEvenPrice: number
}

export function calculateT(
  buyPrice: number,
  sellPrice: number,
  quantity: number,
  settings: Settings,
): TCalculation {
  const buyAmount = round2(buyPrice * quantity)
  const sellAmount = round2(sellPrice * quantity)
  const buyFee = calcFees('buy', buyPrice, quantity, settings)
  const sellFee = calcFees('sell', sellPrice, quantity, settings)
  const grossProfit = round2(sellAmount - buyAmount)
  const netProfit = round2(grossProfit - buyFee - sellFee)
  const netRate = buyAmount > 0 ? (netProfit / buyAmount) * 100 : 0
  return {
    buyAmount,
    sellAmount,
    buyFee,
    sellFee,
    grossProfit,
    netProfit,
    netRate,
    breakEvenPrice: breakEvenSellPrice(buyPrice, quantity, settings),
  }
}

function accountName(accounts: Account[], id: string): string {
  return accounts.find((account) => account.id === id)?.name ?? '未命名账户'
}

export function buildPositions(state: AppState, accountId: string | 'all' = state.currentAccountId): PositionView[] {
  const accounts = state.accounts
  const allow = new Set(
    accountId === 'all' ? accounts.map((account) => account.id) : [accountId],
  )
  const trades = state.trades
    .filter((trade) => allow.has(trade.accountId))
    .sort((a, b) => {
      const aKey = `${a.date} ${a.time} ${a.createdAt}`
      const bKey = `${b.date} ${b.time} ${b.createdAt}`
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0
    })

  const groups = new Map<string, Trade[]>()
  for (const trade of trades) {
    const key = `${trade.accountId}::${trade.symbol}`
    const list = groups.get(key)
    if (list) list.push(trade)
    else groups.set(key, [trade])
  }

  const today = todayStr()
  const canHaveDayPnl = isTradingDay(today)
  const result: PositionView[] = []

  for (const [key, groupTrades] of groups) {
    const [groupAccountId, symbol] = key.split('::')
    const lots: LotView[] = []
    const sells: SellView[] = []
    let realized = 0
    let lastTradeDate = groupTrades[groupTrades.length - 1]?.date ?? ''

    for (const trade of groupTrades) {
      if (trade.side === 'buy') {
        const totalCost = round2(trade.price * trade.quantity + trade.fee)
        lots.push({
          id: `lot_${trade.id}`,
          tradeId: trade.id,
          buyDate: trade.date,
          unlockDate: trade.unlockDate,
          batchLabel: trade.batchLabel,
          quantity: trade.quantity,
          remaining: trade.quantity,
          costPrice: trade.quantity > 0 ? totalCost / trade.quantity : 0,
          totalCost,
          monthsHeld: 0,
        })
        continue
      }

      let remainingToSell = trade.quantity
      let costBasis = 0
      let holdingDaysWeighted = 0
      for (const lot of lots) {
        if (remainingToSell <= 0) break
        if (lot.remaining <= 0) continue
        const take = Math.min(lot.remaining, remainingToSell)
        lot.remaining -= take
        remainingToSell -= take
        costBasis += lot.costPrice * take
        holdingDaysWeighted += daysBetween(lot.buyDate, trade.date) * take
      }
      const soldQuantity = trade.quantity - remainingToSell
      if (soldQuantity <= 0) continue
      const allocatedFee = round2(trade.fee * (soldQuantity / trade.quantity))
      const proceeds = round2(trade.price * soldQuantity - allocatedFee)
      const sellRealized = round2(proceeds - costBasis)
      realized += sellRealized
      sells.push({
        trade,
        quantity: soldQuantity,
        costBasis: round2(costBasis),
        proceeds,
        realized: sellRealized,
        realizedPct: costBasis > 0 ? (sellRealized / costBasis) * 100 : 0,
        holdingDays: soldQuantity > 0 ? holdingDaysWeighted / soldQuantity : 0,
      })
    }

    const quantity = lots.reduce((sum, lot) => sum + lot.remaining, 0)
    const totalCost = round2(lots.reduce((sum, lot) => sum + lot.costPrice * lot.remaining, 0))
    const costPrice = quantity > 0 ? totalCost / quantity : 0
    const lastTrade = groupTrades[groupTrades.length - 1]
    const quote = state.quotes[symbol]
    const price = quote?.price ?? lastTrade?.price ?? costPrice
    const prevClose = quote?.prevClose || price
    const marketValue = round2(price * quantity)
    const unrealized = round2(marketValue - totalCost)
    const unrealizedPct = totalCost > 0 ? (unrealized / totalCost) * 100 : 0
    const todayRealized = canHaveDayPnl
      ? sells.filter((sell) => sell.trade.date === today).reduce((sum, sell) => sum + sell.realized, 0)
      : 0
    const holdingDayPnl = canHaveDayPnl && quantity > 0 ? (price - prevClose) * quantity : 0
    const dayPnl = round2(holdingDayPnl + todayRealized)
    const dayPnlPct = marketValue > 0 ? (dayPnl / Math.max(marketValue - dayPnl, 1)) * 100 : 0

    for (const lot of lots) {
      lot.monthsHeld = lot.buyDate ? daysBetween(lot.buyDate, today) / 30 : 0
    }

    result.push({
      key,
      accountId: groupAccountId,
      accountName: accountName(accounts, groupAccountId),
      symbol,
      name: groupTrades[groupTrades.length - 1]?.name || symbol,
      sector: state.positionMeta[key]?.sector || '未分类',
      quantity,
      costPrice: round2(costPrice * 1000) / 1000,
      totalCost,
      price,
      prevClose,
      marketValue,
      unrealized,
      unrealizedPct,
      realized: round2(realized),
      dayPnl,
      dayPnlPct,
      lots,
      sells,
      trades: groupTrades,
      lastTradeDate,
      meta: state.positionMeta[key],
      quoteUpdatedAt: quote?.updatedAt,
    })
  }

  return result.sort((a, b) => b.marketValue - a.marketValue)
}

export function buildTotals(state: AppState, positions: PositionView[]): PortfolioTotals {
  const accounts =
    state.currentAccountId === 'all'
      ? state.accounts
      : state.accounts.filter((account) => account.id === state.currentAccountId)
  const cash = round2(accounts.reduce((sum, account) => sum + account.cash, 0))
  const marketValue = round2(positions.reduce((sum, position) => sum + position.marketValue, 0))
  const cost = round2(positions.reduce((sum, position) => sum + position.totalCost, 0))
  const unrealized = round2(marketValue - cost)
  const realized = round2(positions.reduce((sum, position) => sum + position.realized, 0))
  const dayPnl = round2(positions.reduce((sum, position) => sum + position.dayPnl, 0))
  const positionCount = positions.filter((position) => position.quantity > 0).length
  const tradeCount = state.trades.filter((trade) =>
    accounts.some((account) => account.id === trade.accountId),
  ).length
  return {
    marketValue,
    cost,
    unrealized,
    unrealizedPct: cost > 0 ? (unrealized / cost) * 100 : 0,
    realized,
    totalPnl: round2(unrealized + realized),
    cash,
    totalAssets: round2(cash + marketValue),
    dayPnl,
    positionCount,
    tradeCount,
  }
}

export function buildAnalytics(state: AppState, positions: PositionView[]): Analytics {
  const sells = positions.flatMap((position) => position.sells)
  const wins = sells.filter((sell) => sell.realized > 0)
  const losses = sells.filter((sell) => sell.realized < 0)
  const grossWin = wins.reduce((sum, sell) => sum + sell.realized, 0)
  const grossLoss = losses.reduce((sum, sell) => sum + sell.realized, 0)
  const closedCount = wins.length + losses.length
  const relevantTrades = positions.flatMap((position) => position.trades)
  const fees = relevantTrades.reduce((sum, trade) => sum + trade.fee, 0)
  const totalHolding = sells.reduce((sum, sell) => sum + sell.holdingDays, 0)

  const months: Analytics['monthly'] = []
  const monthMap = new Map<string, { realized: number; trades: number }>()
  for (const sell of sells) {
    const key = monthKey(sell.trade.date)
    const entry = monthMap.get(key) ?? { realized: 0, trades: 0 }
    entry.realized += sell.realized
    entry.trades += 1
    monthMap.set(key, entry)
  }
  const now = new Date()
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const entry = monthMap.get(key)
    months.push({
      month: key,
      label: monthShort(key),
      realized: round2(entry?.realized ?? 0),
      trades: entry?.trades ?? 0,
    })
  }

  const reasonMap = new Map<string, { count: number; realized: number; wins: number; closed: number }>()
  const emotionMap = new Map<string, { count: number; realized: number; wins: number; closed: number }>()
  for (const sell of sells) {
    const reasons = sell.trade.reasonTags.length > 0 ? sell.trade.reasonTags : ['未标注']
    for (const reason of reasons) {
      const entry = reasonMap.get(reason) ?? { count: 0, realized: 0, wins: 0, closed: 0 }
      entry.count += 1
      entry.realized += sell.realized
      entry.closed += 1
      if (sell.realized > 0) entry.wins += 1
      reasonMap.set(reason, entry)
    }
    const emotion = sell.trade.emotion || '未标注'
    const entry = emotionMap.get(emotion) ?? { count: 0, realized: 0, wins: 0, closed: 0 }
    entry.count += 1
    entry.realized += sell.realized
    entry.closed += 1
    if (sell.realized > 0) entry.wins += 1
    emotionMap.set(emotion, entry)
  }

  const symbolMap = new Map<string, { symbol: string; name: string; realized: number }>()
  for (const sell of sells) {
    const entry = symbolMap.get(sell.trade.symbol) ?? {
      symbol: sell.trade.symbol,
      name: sell.trade.name,
      realized: 0,
    }
    entry.realized += sell.realized
    symbolMap.set(sell.trade.symbol, entry)
  }
  const bySymbol = [...symbolMap.values()].sort((a, b) => b.realized - a.realized)

  return {
    winRate: closedCount > 0 ? (wins.length / closedCount) * 100 : 0,
    wins: wins.length,
    losses: losses.length,
    profitFactor: grossLoss < 0 ? Math.abs(grossWin / grossLoss) : grossWin > 0 ? Infinity : 0,
    avgWin: wins.length > 0 ? grossWin / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    totalRealized: round2(sells.reduce((sum, sell) => sum + sell.realized, 0)),
    avgHoldingDays: sells.length > 0 ? totalHolding / sells.length : 0,
    trades: relevantTrades.length,
    fees: round2(fees),
    monthly: months,
    byReason: [...reasonMap.entries()]
      .map(([tag, entry]) => ({
        tag,
        count: entry.count,
        realized: round2(entry.realized),
        winRate: entry.closed > 0 ? (entry.wins / entry.closed) * 100 : 0,
      }))
      .sort((a, b) => b.realized - a.realized),
    byEmotion: [...emotionMap.entries()]
      .map(([emotion, entry]) => ({
        emotion,
        count: entry.count,
        realized: round2(entry.realized),
        winRate: entry.closed > 0 ? (entry.wins / entry.closed) * 100 : 0,
      }))
      .sort((a, b) => b.realized - a.realized),
    topWinners: bySymbol.filter((item) => item.realized > 0).slice(0, 5),
    topLosers: [...bySymbol].filter((item) => item.realized < 0).reverse().slice(0, 5),
  }
}

export function currentStreak(reviews: { date: string }[]): number {
  const dates = new Set(reviews.map((review) => review.date))
  let cursor = new Date()
  let streak = 0
  const stepBackToTradingDay = () => {
    while (!isTradingDay(formatDate(cursor))) {
      cursor.setDate(cursor.getDate() - 1)
    }
  }
  stepBackToTradingDay()
  while (dates.has(formatDate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
    stepBackToTradingDay()
  }
  return streak
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function monthRealized(positions: PositionView[], month: string): number {
  return round2(
    positions
      .flatMap((position) => position.sells)
      .filter((sell) => sell.trade.date.startsWith(month))
      .reduce((sum, sell) => sum + sell.realized, 0),
  )
}
