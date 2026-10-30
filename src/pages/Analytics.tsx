import { useMemo } from 'react'
import clsx from 'clsx'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Clock3,
  Percent,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui'
import { EquityChart, MonthlyBarChart } from '../components/charts'
import { formatCompact, formatCurrency, formatMoney, formatPct, pnlClass } from '../lib/format'
import type { Snapshot } from '../types'

function maxDrawdown(snapshots: Snapshot[]): { value: number; peakDate: string; troughDate: string } {
  let peak = 0
  let peakDate = ''
  let max = 0
  let maxPeakDate = ''
  let maxTroughDate = ''
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  for (const snapshot of sorted) {
    if (snapshot.totalAssets > peak) {
      peak = snapshot.totalAssets
      peakDate = snapshot.date
    }
    if (peak > 0) {
      const drawdown = ((snapshot.totalAssets - peak) / peak) * 100
      if (drawdown < max) {
        max = drawdown
        maxPeakDate = peakDate
        maxTroughDate = snapshot.date
      }
    }
  }
  return { value: max, peakDate: maxPeakDate, troughDate: maxTroughDate }
}

function Metric({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  tone?: 'green' | 'gold' | 'red' | 'blue'
}) {
  return (
    <Card className="analytics-metric">
      <div className={clsx('kpi-icon', tone && `tone-${tone}`)}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </Card>
  )
}

export function Analytics() {
  const { state, positions, analytics, totals } = useStore()
  const drawdown = useMemo(() => maxDrawdown(state.snapshots), [state.snapshots])
  const active = positions.filter((position) => position.quantity > 0)
  const scopedTradeCount = positions.reduce((sum, position) => sum + position.trades.length, 0)
  const hasTrades = scopedTradeCount > 0
  const grossWin = analytics.avgWin * analytics.wins
  const grossLoss = Math.abs(analytics.avgLoss * analytics.losses)
  const totalClosed = analytics.wins + analytics.losses

  if (!hasTrades) {
    return (
      <div className="page analytics-page">
        <PageHeader eyebrow="复盘与迭代 / 分析" title="数据不会评价你，但会告诉你真相" description="完成几笔交易后，这里会出现你的交易画像。" />
        <Card className="panel">
          <EmptyState
            icon={<BarChart3 size={32} />}
            title="还没有足够的数据"
            description="先在持仓页记录几笔真实交易，分析页会自动计算胜率、盈亏比和月度表现。"
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="page analytics-page">
      <PageHeader
        eyebrow="复盘与迭代 / 分析"
        title="数据不会评价你，但会告诉你真相"
        description={`基于 ${scopedTradeCount} 笔交易、${totalClosed} 笔已平仓卖出计算。`}
        actions={<Badge tone="neutral"><Activity size={12} /> 实时重算</Badge>}
      />

      <div className="analytics-metrics">
        <Metric
          icon={<TrendingUp size={19} />}
          tone="red"
          label="累计已实现盈亏"
          value={`${analytics.totalRealized >= 0 ? '+' : ''}¥ ${formatMoney(analytics.totalRealized)}`}
          sub={`${analytics.wins} 笔盈利 · ${analytics.losses} 笔亏损`}
        />
        <Metric
          icon={<Percent size={19} />}
          tone="green"
          label="交易胜率"
          value={totalClosed > 0 ? `${analytics.winRate.toFixed(1)}%` : '—'}
          sub={`${analytics.wins} 胜 / ${totalClosed} 笔`}
        />
        <Metric
          icon={<Scale size={19} />}
          tone="gold"
          label="盈亏比"
          value={analytics.profitFactor === Infinity ? '∞' : analytics.profitFactor.toFixed(2)}
          sub={`平均盈利 ${formatCompact(analytics.avgWin)} / 平均亏损 ${formatCompact(analytics.avgLoss)}`}
        />
        <Metric
          icon={<Clock3 size={19} />}
          tone="blue"
          label="平均持仓"
          value={`${analytics.avgHoldingDays.toFixed(0)} 天`}
          sub={`累计费用 ${formatCurrency(analytics.fees)}`}
        />
      </div>

      <div className="analytics-grid">
        <Card className="panel analytics-equity">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">资产走势</span>
              <h2>回撤，是复利的另一面</h2>
            </div>
            <Badge tone={drawdown.value < -10 ? 'down' : 'neutral'}>
              最大回撤 {drawdown.value.toFixed(1)}%
            </Badge>
          </div>
          <EquityChart snapshots={state.snapshots} currentAssets={totals.totalAssets} range="ALL" height={300} />
          <div className="drawdown-strip">
            <div>
              <span>最大回撤</span>
              <strong className="is-down">{drawdown.value.toFixed(2)}%</strong>
            </div>
            <div>
              <span>回撤区间</span>
              <strong>{drawdown.peakDate ? `${drawdown.peakDate.slice(5)} → ${drawdown.troughDate.slice(5)}` : '—'}</strong>
            </div>
            <div>
              <span>当前资产</span>
              <strong>{formatCurrency(totals.totalAssets)}</strong>
            </div>
            <div>
              <span>浮动盈亏</span>
              <strong className={pnlClass(totals.unrealized)}>{formatMoney(totals.unrealized)}</strong>
            </div>
          </div>
        </Card>

        <Card className="panel analytics-monthly">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">月度表现</span>
              <h2>哪个月在真正赚钱</h2>
            </div>
          </div>
          <MonthlyBarChart data={analytics.monthly} height={285} />
          <div className="monthly-best">
            {(() => {
              const best = [...analytics.monthly].sort((a, b) => b.realized - a.realized)[0]
              const worst = [...analytics.monthly].sort((a, b) => a.realized - b.realized)[0]
              return (
                <>
                  <div><span>最佳月份</span><strong className="is-up">{best?.label ?? '—'} · {best ? formatCompact(best.realized) : '—'}</strong></div>
                  <div><span>最差月份</span><strong className="is-down">{worst?.label ?? '—'} · {worst ? formatCompact(worst.realized) : '—'}</strong></div>
                </>
              )
            })()}
          </div>
        </Card>

        <Card className="panel quality-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">交易质量</span>
              <h2>让利润奔跑，还是让亏损奔跑？</h2>
            </div>
            <Target size={18} className="muted-icon" />
          </div>
          <div className="quality-bars">
            <div>
              <span><i className="bar-win" /> 平均盈利</span>
              <div className="quality-bar"><span style={{ width: `${grossWin + grossLoss > 0 ? (grossWin / (grossWin + grossLoss)) * 100 : 50}%` }} /></div>
              <strong className="is-up">{formatCompact(analytics.avgWin)}</strong>
            </div>
            <div>
              <span><i className="bar-loss" /> 平均亏损</span>
              <div className="quality-bar loss"><span style={{ width: `${grossWin + grossLoss > 0 ? (grossLoss / (grossWin + grossLoss)) * 100 : 50}%` }} /></div>
              <strong className="is-down">{formatCompact(analytics.avgLoss)}</strong>
            </div>
          </div>
          <div className="quality-note">
            <Sparkles size={15} />
            <p>
              {analytics.avgWin > Math.abs(analytics.avgLoss)
                ? `平均每笔盈利是平均亏损的 ${(analytics.avgWin / Math.abs(analytics.avgLoss || 1)).toFixed(2)} 倍。盈亏比健康，接下来要守住胜率。`
                : '平均亏损大于平均盈利。先别急着提高胜率，优先检查止损是否执行、是否让亏损扩大了。'}
            </p>
          </div>
          <div className="quality-split">
            <div><span>盈利笔数</span><strong className="is-up">{analytics.wins}</strong></div>
            <div><span>亏损笔数</span><strong className="is-down">{analytics.losses}</strong></div>
            <div><span>总费用</span><strong>{formatCompact(analytics.fees)}</strong></div>
          </div>
        </Card>

        <Card className="panel reason-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">归因分析</span>
              <h2>哪种理由真的赚钱</h2>
            </div>
            <Badge tone="neutral">卖出归因</Badge>
          </div>
          {analytics.byReason.length === 0 ? (
            <p className="muted-text">卖出交易还没有打标签。</p>
          ) : (
            <div className="attribution-list">
              {analytics.byReason.slice(0, 8).map((item) => (
                <div className="attribution-row" key={item.tag}>
                  <span className="attribution-name">{item.tag}</span>
                  <div className="attribution-bar">
                    <span style={{ width: `${Math.min(100, item.winRate)}%` }} />
                  </div>
                  <span className="attribution-win">{item.winRate.toFixed(0)}%</span>
                  <strong className={pnlClass(item.realized)}>{item.realized >= 0 ? '+' : ''}{formatCompact(item.realized)}</strong>
                  <small>{item.count} 笔</small>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="panel emotion-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">情绪归因</span>
              <h2>情绪，正在替你花钱吗</h2>
            </div>
            <Badge tone="neutral">卖出归因</Badge>
          </div>
          {analytics.byEmotion.length === 0 ? (
            <p className="muted-text">卖出交易还没有记录情绪。</p>
          ) : (
            <div className="emotion-list">
              {analytics.byEmotion.map((item) => (
                <div className="emotion-row" key={item.emotion}>
                  <span className="emotion-name">{item.emotion}</span>
                  <span className="emotion-count">{item.count} 笔</span>
                  <div className="emotion-track">
                    <span className={item.realized >= 0 ? 'is-up-bg' : 'is-down-bg'} style={{ width: `${Math.min(100, Math.abs(item.realized) / Math.max(...analytics.byEmotion.map((x) => Math.abs(x.realized)), 1) * 100)}%` }} />
                  </div>
                  <strong className={pnlClass(item.realized)}>{item.realized >= 0 ? '+' : ''}{formatCompact(item.realized)}</strong>
                  <small>{item.winRate.toFixed(0)}% 胜率</small>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="panel ranking-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">盈亏排行</span>
              <h2>谁是你的金鸡，谁在拖后腿</h2>
            </div>
          </div>
          <div className="ranking-columns">
            <div>
              <div className="ranking-head"><span><ArrowUpRight size={14} /> 盈利贡献</span></div>
              {analytics.topWinners.length === 0 ? <p className="muted-text small">暂无盈利卖出</p> : analytics.topWinners.map((item) => (
                <div className="ranking-row" key={item.symbol}>
                  <span className="stock-avatar tiny">{item.name.slice(0, 1)}</span>
                  <span><strong>{item.name}</strong><small>{item.symbol}</small></span>
                  <strong className="is-up">+{formatCompact(item.realized)}</strong>
                </div>
              ))}
            </div>
            <div>
              <div className="ranking-head"><span><ArrowDownRight size={14} /> 亏损拖累</span></div>
              {analytics.topLosers.length === 0 ? <p className="muted-text small">暂无亏损卖出</p> : analytics.topLosers.map((item) => (
                <div className="ranking-row" key={item.symbol}>
                  <span className="stock-avatar tiny">{item.name.slice(0, 1)}</span>
                  <span><strong>{item.name}</strong><small>{item.symbol}</small></span>
                  <strong className="is-down">{formatCompact(item.realized)}</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="panel position-risk-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">持仓体检</span>
              <h2>现在的组合，睡得着吗</h2>
            </div>
            <Banknote size={18} className="muted-icon" />
          </div>
          <div className="risk-list">
            {active.map((position) => {
              const weight = totals.marketValue > 0 ? (position.marketValue / totals.marketValue) * 100 : 0
              return (
                <div className="risk-row" key={position.key}>
                  <span><strong>{position.name}</strong><small>{position.sector}</small></span>
                  <div className="risk-weight"><span style={{ width: `${Math.min(100, weight)}%` }} /></div>
                  <span className="risk-pct">{weight.toFixed(1)}%</span>
                  <span className={clsx('risk-pnl', pnlClass(position.unrealized))}>{formatPct(position.unrealizedPct)}</span>
                </div>
              )
            })}
          </div>
          <div className="risk-foot">
            <TrendingDown size={14} />
            <span>单一持仓超过 30% 时，问问自己：这个仓位是否承担了不该承担的风险。</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
