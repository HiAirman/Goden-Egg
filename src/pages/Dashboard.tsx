import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  Coffee,
  Egg,
  Flame,
  NotebookPen,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { useStore } from '../store/AppStore'
import { useUi } from '../components/UiProvider'
import { Badge, Button, Card, EmptyState } from '../components/ui'
import { AllocationDonut, EquityChart } from '../components/charts'
import { currentStreak } from '../lib/calc'
import {
  dateWithWeek,
  daysUntil,
  mondayOf,
  relativeTime,
  todayStr,
} from '../lib/dates'
import { isTradingDay, previousTradingDay, restDayLabel } from '../lib/tradingCalendar'
import {
  formatCompact,
  formatCurrency,
  formatMoney,
  formatPct,
  formatQuantity,
  formatSignedCurrency,
  pnlClass,
} from '../lib/format'
import { EVENT_COLORS } from '../lib/constants'
import { QUOTES } from '../data/quotes'
import { QuoteLine } from '../components/BookQuote'
import type { PageKey } from '../components/Layout'

const SECTOR_COLORS = ['#2f6b4f', '#c28b3e', '#4e6b8a', '#a8483f', '#6f5b8a', '#3b7d7d', '#8a6d55', '#7b8178']

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function KpiCard({
  label,
  value,
  trend,
  sub,
  icon,
  tone,
}: {
  label: string
  value: string
  trend?: { value: number; text: string }
  sub?: string
  icon: React.ReactNode
  tone?: 'green' | 'gold' | 'red' | 'blue'
}) {
  return (
    <Card className="kpi-card">
      <div className={clsx('kpi-icon', tone && `tone-${tone}`)}>{icon}</div>
      <div className="kpi-body">
        <span className="kpi-label">{label}</span>
        <strong className="kpi-value">{value}</strong>
        <div className="kpi-foot">
          {trend ? (
            <span className={pnlClass(trend.value)}>
              {trend.value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {trend.text}
            </span>
          ) : null}
          {sub ? <small>{sub}</small> : null}
        </div>
      </div>
    </Card>
  )
}

export function Dashboard({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const { state, positions, totals, analytics, captureSnapshot, quoteBusy } = useStore()
  const { openTrade, toast } = useUi()
  const [range, setRange] = useState<'1M' | '3M' | '1Y' | 'ALL'>('3M')
  const today = todayStr()
  const tradingDay = isTradingDay(today)
  const restLabel = restDayLabel(today)
  const previousTrading = previousTradingDay(today)
  const todayReview = state.reviews.find((review) => review.date === today)
  const scopedTrades = positions.flatMap((position) => position.trades)
  const todayTrades = scopedTrades.filter((trade) => trade.date === today)
  const activePositions = positions.filter((position) => position.quantity > 0)
  const topPositions = [...activePositions].sort((a, b) => b.marketValue - a.marketValue).slice(0, 5)
  const recentTrades = [...scopedTrades].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).slice(0, 4)
  const streak = currentStreak(state.reviews)
  const upcoming = [...state.events]
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const riskPositions = activePositions.filter(
    (position) => position.meta?.stopLoss && position.price <= position.meta.stopLoss,
  )
  const sectorMap = new Map<string, number>()
  for (const position of activePositions) {
    sectorMap.set(position.sector, (sectorMap.get(position.sector) ?? 0) + position.marketValue)
  }
  const allocation = [...sectorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      color: SECTOR_COLORS[index % SECTOR_COLORS.length],
    }))

  const handleSnapshot = () => {
    captureSnapshot()
    toast('已更新今日资产快照', 'success')
  }

  const indices = ['sh000001', 'sz399001', 'sz399006'].map((symbol) => ({
    symbol,
    quote: state.quotes[symbol],
  }))
  const totalReturn = totals.totalAssets > 0 ? (totals.totalPnl / Math.max(totals.totalAssets - totals.totalPnl, 1)) * 100 : 0
  const dayBase = totals.totalAssets - totals.dayPnl
  const snapshotDone = state.snapshots.some((item) => item.date === today)
  const dayPct = dayBase > 0 ? (totals.dayPnl / dayBase) * 100 : 0
  const reviewProgress = [
    Boolean(todayReview),
    snapshotDone,
    riskPositions.length === 0,
  ].filter(Boolean).length

  return (
    <div className="page dashboard-page">
      <div className="dash-hero">
        <div className="dash-hero-main">
          <div className="hero-kicker">
            <span>{dateWithWeek(today)}</span>
            <i />
            <span>
              {tradingDay ? `第 ${Math.max(1, state.reviews.length + 1)} 天复盘` : restLabel}
            </span>
          </div>
          <h1>
            {tradingDay ? (
              <>
                {greeting()}。先看清风险，
                <em>再谈收益</em>。
              </>
            ) : (
              <>
                今天休市，不交易，
                <em>不生成每日复盘</em>。
              </>
            )}
          </h1>
          <p>
            {!tradingDay
              ? `${restLabel}，A股不交易，也不会生成每日复盘。可以回看上一交易日，或整理本周交易。`
              : todayReview
                ? '今天的复盘已记录，可以继续补充。'
                : todayTrades.length > 0
                  ? `今天有 ${todayTrades.length} 笔交易，核对成交时间、费用和理由。`
                  : '没有交易也可以记录观察；有交易则先写事实。'}
          </p>
          <div className="hero-actions">
            {tradingDay ? (
              <>
                <Button icon={<NotebookPen size={16} />} onClick={() => onNavigate('reviews')}>
                  {todayReview ? '继续今日复盘' : '写今日复盘'}
                </Button>
                <Button variant="secondary" icon={<Plus size={16} />} onClick={() => openTrade()}>
                  记录交易
                </Button>
                <button type="button" className="text-btn" onClick={handleSnapshot}>
                  <RefreshCw size={13} /> 更新今日快照
                </button>
              </>
            ) : (
              <>
                <Button
                  icon={<NotebookPen size={16} />}
                  onClick={() => { window.location.hash = `#/reviews?date=${previousTrading}` }}
                >
                  查看上一交易日
                </Button>
                <Button
                  variant="secondary"
                  icon={<BookOpen size={16} />}
                  onClick={() => { window.location.hash = `#/reviews?week=${mondayOf(today)}` }}
                >
                  写本周复盘
                </Button>
                <Badge tone="gold"><Coffee size={12} /> 休市日</Badge>
              </>
            )}
          </div>
        </div>
        <div className="dash-hero-side">
          <div className="hero-asset-label">
            <span>总资产</span>
            <Badge tone="gold">本机数据</Badge>
          </div>
          <strong className="hero-asset-value">
            <small>¥</small>
            {formatMoney(totals.totalAssets)}
          </strong>
          <div className={clsx('hero-asset-change', pnlClass(totals.dayPnl))}>
            {tradingDay ? (
              <>
                <span>
                  今日 {totals.dayPnl >= 0 ? '+' : ''}
                  {formatMoney(totals.dayPnl)}
                </span>
                <span>{formatPct(dayPct)}</span>
              </>
            ) : (
              <span className="rest-market-line">今日休市 · 价格保持上一交易日收盘</span>
            )}
          </div>
          <div className="hero-asset-grid">
            <div>
              <span>持仓市值</span>
              <strong>{formatCompact(totals.marketValue)}</strong>
            </div>
            <div>
              <span>可用现金</span>
              <strong>{formatCompact(totals.cash)}</strong>
            </div>
            <div>
              <span>累计盈亏</span>
              <strong className={pnlClass(totals.totalPnl)}>{formatCompact(totals.totalPnl)}</strong>
            </div>
          </div>
          <div className="hero-egg">
            <Egg size={30} strokeWidth={1.4} />
            <span>
              持仓 {totals.positionCount} 只 · 仓位 {totals.totalAssets > 0 ? ((totals.marketValue / totals.totalAssets) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </div>
      </div>

      <div className="market-strip">
        {indices.map(({ symbol, quote }) => (
          <div className="market-index" key={symbol}>
            <span>{quote?.name ?? (symbol === 'sh000001' ? '上证指数' : symbol === 'sz399001' ? '深证成指' : '创业板指')}</span>
            <strong>{quote ? quote.price.toFixed(2) : '—'}</strong>
            <small className={quote ? pnlClass(quote.changePct) : undefined}>
              {quote ? formatPct(quote.changePct) : '待刷新'}
            </small>
          </div>
        ))}
        <button type="button" className="market-refresh" onClick={() => onNavigate('settings')}>
          {tradingDay ? <Clock3 size={13} /> : <Coffee size={13} />}
          {!tradingDay ? restLabel : quoteBusy ? '行情更新中' : '行情由腾讯财经提供'}
        </button>
      </div>

      <div className="kpi-grid">
        <KpiCard
          label="总资产"
          value={`¥ ${formatMoney(totals.totalAssets)}`}
          icon={<Wallet size={19} />}
          tone="green"
          sub={`现金 ${formatCurrency(totals.cash)}`}
        />
        <KpiCard
          label="持仓市值"
          value={`¥ ${formatMoney(totals.marketValue)}`}
          icon={<TrendingUp size={19} />}
          tone="blue"
          sub={`持仓成本 ${formatCompact(totals.cost)}`}
        />
        <KpiCard
          label="累计盈亏"
          value={formatSignedCurrency(totals.totalPnl)}
          icon={<Target size={19} />}
          tone={totals.totalPnl >= 0 ? 'red' : 'green'}
          trend={{ value: totalReturn, text: formatPct(totalReturn) }}
          sub={`已实现 ${formatCompact(totals.realized)}`}
        />
        <KpiCard
          label={tradingDay ? '今日盈亏' : '今日休市'}
          value={tradingDay ? formatSignedCurrency(totals.dayPnl) : '—'}
          icon={tradingDay ? (totals.dayPnl >= 0 ? <TrendingUp size={19} /> : <TrendingDown size={19} />) : <Coffee size={19} />}
          tone={tradingDay ? (totals.dayPnl >= 0 ? 'red' : 'green') : 'gold'}
          trend={tradingDay ? { value: dayPct, text: formatPct(dayPct) } : undefined}
          sub={tradingDay ? '浮动 + 今日已实现' : restLabel}
        />
      </div>

      <div className="dashboard-grid">
        <Card className="panel equity-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">资产曲线</span>
              <h2>资产净值曲线</h2>
            </div>
            <div className="range-tabs">
              {(['1M', '3M', '1Y', 'ALL'] as const).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={clsx(range === item && 'is-active')}
                  onClick={() => setRange(item)}
                >
                  {item === 'ALL' ? '全部' : item}
                </button>
              ))}
            </div>
          </div>
          <EquityChart snapshots={state.snapshots} currentAssets={totals.totalAssets} range={range} />
          <div className="equity-foot">
            <span>
              <i className="dot-green" /> 总资产
            </span>
            <span>
              快照 {state.snapshots.length} 天 · 最近更新 {state.snapshots.length ? relativeTime(state.snapshots[state.snapshots.length - 1].createdAt) : '尚未更新'}
            </span>
          </div>
          <div className="panel-quote">
            <QuoteLine quote={QUOTES.bogleEnemies} />
          </div>
        </Card>

        <Card className="panel allocation-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">持仓结构</span>
              <h2>行业与仓位分布</h2>
            </div>
            <Badge tone="neutral">{activePositions.length} 只</Badge>
          </div>
          <AllocationDonut data={allocation} total={totals.marketValue} height={220} />
          <button type="button" className="panel-link" onClick={() => onNavigate('positions')}>
            查看全部持仓 <ArrowUpRight size={14} />
          </button>
        </Card>

        <Card className="panel positions-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">核心持仓</span>
              <h2>当前持仓</h2>
            </div>
            <button type="button" className="panel-link inline" onClick={() => onNavigate('positions')}>
              全部持仓 <ArrowUpRight size={14} />
            </button>
          </div>
          {topPositions.length === 0 ? (
            <EmptyState
              compact
              icon={<Egg size={26} />}
              title="还没有持仓"
              description="记录第一笔买入，建立持仓档案。"
              action={<Button size="sm" onClick={() => openTrade()}>添加买入</Button>}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table compact-table">
                <thead>
                  <tr>
                    <th>股票</th>
                    <th className="num">现价</th>
                    <th className="num">市值</th>
                    <th className="num">浮动盈亏</th>
                    <th className="num">仓位</th>
                  </tr>
                </thead>
                <tbody>
                  {topPositions.map((position) => (
                    <tr key={position.key}>
                      <td>
                        <div className="stock-cell">
                          <span className="stock-avatar">{position.name.slice(0, 1)}</span>
                          <div>
                            <strong>{position.name}</strong>
                            <small>{position.symbol} · {position.sector}</small>
                          </div>
                        </div>
                      </td>
                      <td className="num">
                        <strong>{position.price.toFixed(2)}</strong>
                        <small className={pnlClass(position.price - position.prevClose)}>
                          {formatPct(position.prevClose > 0 ? ((position.price - position.prevClose) / position.prevClose) * 100 : 0)}
                        </small>
                      </td>
                      <td className="num">{formatCompact(position.marketValue)}</td>
                      <td className={clsx('num', pnlClass(position.unrealized))}>
                        <strong>{position.unrealized >= 0 ? '+' : ''}{formatMoney(position.unrealized)}</strong>
                        <small>{formatPct(position.unrealizedPct)}</small>
                      </td>
                      <td className="num">
                        {totals.marketValue > 0 ? ((position.marketValue / totals.marketValue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="dash-side-column">
          <Card className="panel review-todo">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">今日清单</span>
                <h2>{tradingDay ? '复盘三件事' : '今天不交易'}</h2>
              </div>
              <div className="streak-badge" title="连续复盘交易日">
                <Flame size={14} />
                {streak} 天
              </div>
            </div>
            {tradingDay ? (
              <>
                <div className="todo-list">
                  <button type="button" className="todo-item" onClick={() => onNavigate('reviews')}>
                    {todayReview ? <CheckCircle2 size={18} className="is-done" /> : <Circle size={18} />}
                    <span>
                      <strong>写下今天的复盘</strong>
                      <small>{todayReview ? '已完成，可以继续补充' : '市场、操作、情绪各写一句'}</small>
                    </span>
                  </button>
                  <button type="button" className="todo-item" onClick={handleSnapshot}>
                    {snapshotDone ? <CheckCircle2 size={18} className="is-done" /> : <Circle size={18} />}
                    <span>
                      <strong>更新资产快照</strong>
                      <small>{snapshotDone ? '今天已记录' : '记录今天收盘后的资产'}</small>
                    </span>
                  </button>
                  <button type="button" className="todo-item" onClick={() => onNavigate('positions')}>
                    {riskPositions.length > 0 ? <ShieldAlert size={18} className="is-risk" /> : <CheckCircle2 size={18} className="is-done" />}
                    <span>
                      <strong>检查止损边界</strong>
                      <small>{riskPositions.length > 0 ? `${riskPositions.length} 只已跌破止损价` : '所有持仓都在计划内'}</small>
                    </span>
                  </button>
                </div>
                <div className="todo-progress">
                  <span style={{ width: `${(reviewProgress / 3) * 100}%` }} />
                </div>
              </>
            ) : (
              <div className="rest-todo">
                <div className="rest-todo-icon"><Coffee size={22} /></div>
                <strong>{restLabel}</strong>
                <p>休市日没有交易和每日复盘。可以回看上一交易日，或写周复盘。</p>
                <div className="rest-todo-actions">
                  <Button size="sm" variant="secondary" onClick={() => { window.location.hash = `#/reviews?date=${previousTrading}` }}>
                    上一交易日
                  </Button>
                  <Button size="sm" onClick={() => { window.location.hash = `#/reviews?week=${mondayOf(today)}` }}>
                    写周复盘
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="panel next-event">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">下一件事</span>
                <h2>别忘了日历</h2>
              </div>
              <CalendarClock size={18} className="muted-icon" />
            </div>
            {upcoming ? (
              <button type="button" className="event-preview" onClick={() => onNavigate('calendar')}>
                <span className="event-date-block">
                  <strong>{upcoming.date.slice(8)}</strong>
                  <small>{upcoming.date.slice(5, 7)}月</small>
                </span>
                <span className="event-preview-text">
                  <strong>{upcoming.title}</strong>
                  <small>
                    {daysUntil(upcoming.date) === 0 ? '今天' : daysUntil(upcoming.date) > 0 ? `${daysUntil(upcoming.date)} 天后` : '已过期'}
                    {upcoming.symbol ? ` · ${upcoming.symbol}` : ''}
                  </small>
                </span>
                <i style={{ background: EVENT_COLORS[upcoming.type] }} />
              </button>
            ) : (
              <p className="muted-text">近期没有事件，去日历添加一个提醒。</p>
            )}
            <button type="button" className="panel-link" onClick={() => onNavigate('calendar')}>
              打开日历 <ArrowUpRight size={14} />
            </button>
          </Card>

          <Card className="panel insight-card">
            <div className="insight-head">
              <Sparkles size={16} />
              <span>本周洞察</span>
            </div>
            <p>
              {analytics.wins + analytics.losses > 0 ? (
                <>
                  已平仓交易胜率 <strong>{analytics.winRate.toFixed(0)}%</strong>，
                  {analytics.avgWin > Math.abs(analytics.avgLoss)
                    ? '平均盈利大于平均亏损；继续检查止损与仓位是否符合计划。'
                    : '平均亏损大于平均盈利；优先检查止损是否执行到位。'}
                </>
              ) : (
                '还没有已平仓交易。完成第一笔卖出后，这里会出现你的交易画像。'
              )}
            </p>
            <div className="insight-meta">
              <span><ClipboardCheck size={13} /> {analytics.trades} 笔交易</span>
              <span><Target size={13} /> 费用 {formatCompact(analytics.fees)}</span>
            </div>
          </Card>
        </div>
      </div>

      <Card className="panel recent-trades-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">最近动作</span>
            <h2>最近交易</h2>
          </div>
          <button type="button" className="panel-link inline" onClick={() => onNavigate('trades')}>
            全部流水 <ArrowUpRight size={14} />
          </button>
        </div>
        {recentTrades.length === 0 ? (
          <EmptyState compact title="还没有交易记录" description="记录第一笔交易后，这里会显示最近流水。" action={<Button size="sm" onClick={() => openTrade()}>记录交易</Button>} />
        ) : (
          <div className="recent-trade-list">
            {recentTrades.map((trade) => (
              <button
                type="button"
                className="recent-trade-row"
                key={trade.id}
                onClick={() => openTrade({ trade })}
              >
                <span className={clsx('side-pill', trade.side)}>{trade.side === 'buy' ? '买' : '卖'}</span>
                <span className="recent-trade-stock">
                  <strong>{trade.name}</strong>
                  <small>{trade.symbol} · {trade.date} {trade.time}</small>
                </span>
                <span className="recent-trade-tags">
                  {trade.reasonTags.slice(0, 2).map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
                </span>
                <span className="recent-trade-amount">
                  <strong>{formatCurrency(trade.price * trade.quantity)}</strong>
                  <small>{formatQuantity(trade.quantity)} 股 @ {trade.price.toFixed(2)}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
