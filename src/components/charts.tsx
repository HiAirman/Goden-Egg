import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Snapshot } from '../types'
import { formatCompact, formatCurrency, formatMoney, formatPct, pnlTone } from '../lib/format'
import { dateShort, monthShort, shiftDate, todayStr } from '../lib/dates'
import { isTradingDay } from '../lib/tradingCalendar'

interface TooltipPayloadItem {
  name?: string
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

function ChartTooltip({
  active,
  payload,
  label,
  money = true,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  money?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((item, index) => (
        <div className="chart-tooltip-row" key={`${item.name}-${index}`}>
          <span>
            <i style={{ background: item.color }} />
            {item.name}
          </span>
          <strong>
            {money ? formatCurrency(Number(item.value ?? 0)) : Number(item.value ?? 0).toLocaleString('zh-CN')}
          </strong>
        </div>
      ))}
    </div>
  )
}

export function EquityChart({
  snapshots,
  currentAssets,
  range,
  height = 280,
}: {
  snapshots: Snapshot[]
  currentAssets: number
  range: '1M' | '3M' | '1Y' | 'ALL'
  height?: number
}) {
  const days = range === '1M' ? 31 : range === '3M' ? 92 : range === '1Y' ? 365 : 3650
  const cutoffKey = shiftDate(todayStr(), -days)
  const filtered = snapshots.filter((snapshot) => snapshot.date >= cutoffKey)
  const data = filtered.map((snapshot) => ({
    date: snapshot.date,
    label: dateShort(snapshot.date),
    assets: snapshot.totalAssets,
    cost: snapshot.cost,
  }))
  if (isTradingDay(todayStr()) && data.length > 0 && data[data.length - 1].date !== todayStr()) {
    data.push({
      date: todayStr(),
      label: '今天',
      assets: currentAssets,
      cost: data[data.length - 1].cost,
    })
  }
  const values = data.map((item) => item.assets)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const padding = Math.max((max - min) * 0.12, max * 0.01, 1000)
  const first = data[0]?.assets ?? currentAssets
  const last = data[data.length - 1]?.assets ?? currentAssets
  const gain = last - first
  const gainPct = first > 0 ? (gain / first) * 100 : 0

  return (
    <div className="chart-wrap" style={{ height }}>
      {data.length < 2 ? (
        <div className="chart-empty">
          <strong>还没有足够的资产快照</strong>
          <span>每天更新一次快照，这里会形成你的资产曲线。</span>
        </div>
      ) : (
        <>
          <div className="chart-summary">
            <span className={pnlTone(gain)}>
              {gain >= 0 ? '+' : ''}
              {formatMoney(gain)}（{formatPct(gainPct)}）
            </span>
            <small>区间变化</small>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2f6b4f" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2f6b4f" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e7e0d1" strokeDasharray="2 6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#8a8d83', fontSize: 13 }}
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <YAxis
                domain={[min - padding, max + padding]}
                tick={{ fill: '#8a8d83', fontSize: 13 }}
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(value) => formatCompact(Number(value))}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={first} stroke="#cfc7b6" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="assets"
                name="总资产"
                stroke="#2f6b4f"
                strokeWidth={2.4}
                fill="url(#equityFill)"
                activeDot={{ r: 4, fill: '#2f6b4f', stroke: '#fffdf8', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}

export function AllocationDonut({
  data,
  total,
  height = 240,
}: {
  data: { name: string; value: number; color: string }[]
  total: number
  height?: number
}) {
  const chartData = data.filter((item) => item.value > 0)
  if (chartData.length === 0) {
    return (
      <div className="chart-empty" style={{ height }}>
        <strong>暂无持仓分布</strong>
        <span>添加第一笔买入后，这里会自动生成。</span>
      </div>
    )
  }
  return (
    <div className="donut-layout" style={{ minHeight: height }}>
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {chartData.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <small>持仓市值</small>
          <strong>{formatCompact(total)}</strong>
        </div>
      </div>
      <div className="donut-legend">
        {chartData.map((item) => (
          <div className="donut-legend-row" key={item.name}>
            <span>
              <i style={{ background: item.color }} />
              {item.name}
            </span>
            <strong>{total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : '0%'}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MonthlyBarChart({
  data,
  height = 260,
}: {
  data: { label: string; realized: number; trades: number }[]
  height?: number
}) {
  return (
    <div className="chart-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e7e0d1" strokeDasharray="2 6" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#8a8d83', fontSize: 13 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fill: '#8a8d83', fontSize: 13 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value) => formatCompact(Number(value))}
          />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={0} stroke="#cfc7b6" />
          <Bar dataKey="realized" name="已实现盈亏" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {data.map((item) => (
              <Cell key={item.label} fill={item.realized >= 0 ? '#c2574a' : '#3b8465'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Sparkline({
  values,
  width = 96,
  height = 34,
  color = '#2f6b4f',
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (values.length < 2) return <span className="spark-empty">—</span>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - 3 - ((value - min) / range) * (height - 6)
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MonthLabel({ month }: { month: string }) {
  return <span>{monthShort(month)}</span>
}
