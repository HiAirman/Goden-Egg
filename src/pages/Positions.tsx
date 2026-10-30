import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Layers,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Target,
  Unlock,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { useUi } from '../components/UiProvider'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Textarea,
  Toggle,
} from '../components/ui'
import type { PositionMeta, PositionView } from '../types'
import { SECTORS } from '../lib/constants'
import { daysUntil, todayStr } from '../lib/dates'
import { isTradingDay, restDayLabel } from '../lib/tradingCalendar'
import { QUOTES } from '../data/quotes'
import { QuoteLine } from '../components/BookQuote'
import {
  formatCurrency,
  formatMoney,
  formatPct,
  formatPrice,
  formatQuantity,
  pnlClass,
  round2,
  safeNumber,
} from '../lib/format'

function MetaModal({
  position,
  onClose,
}: {
  position: PositionView | null
  onClose: () => void
}) {
  const { updatePositionMeta } = useStore()
  const { toast } = useUi()
  const [sector, setSector] = useState(position?.meta?.sector ?? position?.sector ?? '其他')
  const [thesis, setThesis] = useState(position?.meta?.thesis ?? '')
  const [stopLoss, setStopLoss] = useState(position?.meta?.stopLoss ? String(position.meta.stopLoss) : '')
  const [targetPrice, setTargetPrice] = useState(position?.meta?.targetPrice ? String(position.meta.targetPrice) : '')
  const [tags, setTags] = useState((position?.meta?.tags ?? []).join('，'))

  const save = () => {
    if (!position) return
    const meta: PositionMeta = {
      sector,
      thesis: thesis.trim(),
      stopLoss: safeNumber(stopLoss) > 0 ? safeNumber(stopLoss) : undefined,
      targetPrice: safeNumber(targetPrice) > 0 ? safeNumber(targetPrice) : undefined,
      tags: tags
        .split(/[，,、\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      updatedAt: Date.now(),
    }
    updatePositionMeta(position.key, meta)
    toast('持仓备注已保存', 'success')
    onClose()
  }

  return (
    <Modal
      open={Boolean(position)}
      onClose={onClose}
      title={position ? `编辑 ${position.name} 的持仓计划` : '编辑持仓计划'}
      subtitle="在买入之前想清楚，在持有期间才有据可依。"
      width={580}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={save}>保存</Button>
        </>
      }
    >
      <div className="form-grid form-grid-2">
        <Field label="所属板块">
          <Select value={sector} onChange={(event) => setSector(event.target.value)}>
            {SECTORS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <Field label="标签" hint="用逗号分隔，例如：核心仓，低估值">
          <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="核心仓，低估值" />
        </Field>
        <Field label="止损价" hint="跌破后会出现在风险提醒里">
          <div className="input-affix">
            <span>¥</span>
            <Input type="number" step="0.01" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} placeholder="0.00" />
          </div>
        </Field>
        <Field label="目标价" hint="达到后提醒自己检查止盈计划">
          <div className="input-affix">
            <span>¥</span>
            <Input type="number" step="0.01" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="0.00" />
          </div>
        </Field>
      </div>
      <Field label="持有逻辑" hint="逻辑没变就拿着，逻辑变了就重新评估">
        <Textarea
          rows={5}
          value={thesis}
          onChange={(event) => setThesis(event.target.value)}
          placeholder="为什么买它？关键变量是什么？什么情况下会卖出？"
        />
      </Field>
    </Modal>
  )
}

function PriceModal({
  position,
  onClose,
}: {
  position: PositionView | null
  onClose: () => void
}) {
  const { setManualPrice } = useStore()
  const { toast } = useUi()
  const [price, setPrice] = useState(position ? String(position.price) : '')
  const save = () => {
    if (!position || safeNumber(price) <= 0) return
    setManualPrice(position.symbol, round2(safeNumber(price)))
    toast(`已将 ${position.name} 现价更新为 ${formatPrice(safeNumber(price))}`, 'success')
    onClose()
  }
  return (
    <Modal
      open={Boolean(position)}
      onClose={onClose}
      title={position ? `更新 ${position.name} 现价` : '更新现价'}
      subtitle="行情接口不可用时，可以手动维护价格。"
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={save}>保存现价</Button>
        </>
      }
    >
      <Field label="最新价格">
        <div className="input-affix">
          <span>¥</span>
          <Input
            type="number"
            step="0.01"
            autoFocus
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
      </Field>
    </Modal>
  )
}

function PositionDetail({
  position,
  onEdit,
  onPrice,
}: {
  position: PositionView
  onEdit: () => void
  onPrice: () => void
}) {
  const { openTrade } = useUi()
  const today = todayStr()
  const locked = position.lots
    .filter((lot) => lot.remaining > 0 && lot.unlockDate && lot.unlockDate > today)
    .reduce((sum, lot) => sum + lot.remaining, 0)
  const meta = position.meta
  const risk = meta?.stopLoss && position.price <= meta.stopLoss
  const target = meta?.targetPrice && position.price >= meta.targetPrice

  return (
    <div className="position-detail">
      <div className="position-detail-grid">
        <div className="position-thesis">
          <div className="detail-heading">
            <span>持有逻辑</span>
            <button type="button" onClick={onEdit}><Pencil size={13} /> 编辑</button>
          </div>
          <p>{meta?.thesis || '还没有写下持有逻辑。问自己：为什么买它？什么情况下会卖？'}</p>
          <div className="position-tags">
            {(meta?.tags ?? []).map((tag) => <Badge key={tag} tone="green">{tag}</Badge>)}
            {locked > 0 ? <Badge tone="gold"><Lock size={11} /> 锁定 {locked} 股</Badge> : null}
          </div>
          <div className="risk-grid">
            <div className={clsx('risk-box', risk && 'is-risk')}>
              <span><ShieldAlert size={13} /> 止损价</span>
              <strong>{meta?.stopLoss ? `¥ ${formatPrice(meta.stopLoss)}` : '未设置'}</strong>
              {meta?.stopLoss ? (
                <small className={pnlClass(position.price - meta.stopLoss)}>
                  距离现价 {formatPct(((position.price - meta.stopLoss) / meta.stopLoss) * 100)}
                </small>
              ) : (
                <small>跌破时提醒自己</small>
              )}
            </div>
            <div className={clsx('risk-box', target && 'is-target')}>
              <span><Target size={13} /> 目标价</span>
              <strong>{meta?.targetPrice ? `¥ ${formatPrice(meta.targetPrice)}` : '未设置'}</strong>
              {meta?.targetPrice ? (
                <small className={pnlClass(meta.targetPrice - position.price)}>
                  距离目标 {formatPct(((meta.targetPrice - position.price) / position.price) * 100)}
                </small>
              ) : (
                <small>给上涨一个边界</small>
              )}
            </div>
          </div>
          <div className="position-detail-actions">
            <Button size="sm" icon={<Plus size={14} />} onClick={() => openTrade({ preset: { accountId: position.accountId, symbol: position.symbol, name: position.name, side: 'buy' } })}>
              加仓
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<ArrowUpRight size={14} />}
              onClick={() => openTrade({ preset: { accountId: position.accountId, symbol: position.symbol, name: position.name, side: 'sell', price: position.price } })}
            >
              卖出
            </Button>
            <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={onPrice}>
              改现价
            </Button>
          </div>
        </div>

        <div className="position-lots">
          <div className="detail-heading">
            <span><Layers size={14} /> 持仓批次</span>
            <small>{position.lots.length} 个买入批次 · FIFO 卖出</small>
          </div>
          <div className="lot-table">
            <div className="lot-row lot-head">
              <span>买入日期</span>
              <span>批次</span>
              <span className="num">剩余 / 原始</span>
              <span className="num">成本价</span>
              <span>状态</span>
            </div>
            {position.lots.map((lot) => {
              const isLocked = lot.unlockDate && lot.unlockDate > today && lot.remaining > 0
              return (
                <div className="lot-row" key={lot.id}>
                  <span>{lot.buyDate}</span>
                  <span className="lot-label">{lot.batchLabel || '普通买入'}</span>
                  <span className="num">{formatQuantity(lot.remaining)} / {formatQuantity(lot.quantity)}</span>
                  <span className="num">¥ {formatPrice(lot.costPrice)}</span>
                  <span>
                    {lot.remaining === 0 ? (
                      <Badge tone="neutral">已卖出</Badge>
                    ) : isLocked ? (
                      <Badge tone="gold"><Lock size={10} /> {daysUntil(lot.unlockDate!)} 天后解禁</Badge>
                    ) : lot.unlockDate ? (
                      <Badge tone="green"><Unlock size={10} /> 已解禁</Badge>
                    ) : (
                      <Badge tone="neutral">可卖</Badge>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="position-trade-history">
        <div className="detail-heading">
          <span>交易记录</span>
          <small>共 {position.trades.length} 笔</small>
        </div>
        <div className="mini-trade-list">
          {[...position.trades].reverse().map((trade) => (
            <div className="mini-trade" key={trade.id}>
              <span className={clsx('side-pill', trade.side)}>{trade.side === 'buy' ? '买' : '卖'}</span>
              <span>{trade.date} {trade.time}</span>
              <span>{formatQuantity(trade.quantity)} 股 @ ¥{formatPrice(trade.price)}</span>
              <span className="mini-trade-note">{trade.note || trade.reasonTags.join(' · ') || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Positions() {
  const { state, positions, totals } = useStore()
  const { openTrade } = useUi()
  const [query, setQuery] = useState('')
  const [showCleared, setShowCleared] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [metaPosition, setMetaPosition] = useState<PositionView | null>(null)
  const [pricePosition, setPricePosition] = useState<PositionView | null>(null)

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    return positions.filter((position) => {
      if (!showCleared && position.quantity <= 0) return false
      if (!text) return true
      return (
        position.symbol.toLowerCase().includes(text) ||
        position.name.toLowerCase().includes(text) ||
        position.sector.toLowerCase().includes(text)
      )
    })
  }, [positions, query, showCleared])

  const active = positions.filter((position) => position.quantity > 0)
  const tradingDay = isTradingDay(todayStr())
  const restLabel = restDayLabel(todayStr())
  const riskCount = active.filter((position) => position.meta?.stopLoss && position.price <= position.meta.stopLoss).length
  const totalUnrealized = active.reduce((sum, position) => sum + position.unrealized, 0)
  const totalDayPnl = active.reduce((sum, position) => sum + position.dayPnl, 0)

  return (
    <div className="page positions-page">
      <PageHeader
        eyebrow="工作台 / 持仓"
        title="持仓与风险边界"
        description={
          <>
            <QuoteLine quote={QUOTES.lynchOwn} />
            <span className="page-header-meta">
              {active.length} 只持仓 · 总市值 {formatCurrency(totals.marketValue)} · 可用现金 {formatCurrency(totals.cash)}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => setPricePosition(active[0] ?? null)} disabled={active.length === 0}>
              手动更新现价
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => openTrade()}>记录交易</Button>
          </>
        }
      />

      <div className="position-summary-strip">
        <div>
          <span>持仓市值</span>
          <strong>{formatCurrency(totals.marketValue)}</strong>
        </div>
        <div>
          <span>浮动盈亏</span>
          <strong className={pnlClass(totalUnrealized)}>{totalUnrealized >= 0 ? '+' : ''}{formatMoney(totalUnrealized)}</strong>
        </div>
        <div title={tradingDay ? undefined : restLabel}>
          <span>{tradingDay ? '今日盈亏' : '今日休市'}</span>
          <strong className={tradingDay ? pnlClass(totalDayPnl) : undefined}>
            {tradingDay ? `${totalDayPnl >= 0 ? '+' : ''}${formatMoney(totalDayPnl)}` : '—'}
          </strong>
        </div>
        <div>
          <span>风险提醒</span>
          <strong className={riskCount > 0 ? 'is-down' : undefined}>{riskCount > 0 ? `${riskCount} 只跌破止损` : '暂无'}</strong>
        </div>
      </div>

      <Card className="positions-card">
        <div className="list-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="搜索代码、名称或板块" />
          <div className="list-toolbar-right">
            <Toggle checked={showCleared} onChange={setShowCleared} label="显示已清仓" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Layers size={30} />}
            title={positions.length === 0 ? '还没有持仓' : '没有匹配的持仓'}
            description={positions.length === 0 ? '记录第一笔买入，建立持仓成本、批次和风险边界。' : '调整关键词，或者显示已清仓的股票。'}
            action={positions.length === 0 ? <Button onClick={() => openTrade()}>记录第一笔买入</Button> : null}
          />
        ) : (
          <div className="position-list">
            <div className="position-list-head">
              <span>股票</span>
              <span className="num">现价 / 涨跌</span>
              <span className="num">持仓 / 成本</span>
              <span className="num">市值</span>
              <span className="num">浮动盈亏</span>
              <span className="num">仓位</span>
              <span />
            </div>
            {filtered.map((position) => {
              const isOpen = expanded === position.key
              const risk = position.meta?.stopLoss && position.price <= position.meta.stopLoss
              const locked = position.lots
                .filter((lot) => lot.remaining > 0 && lot.unlockDate && lot.unlockDate > todayStr())
                .reduce((sum, lot) => sum + lot.remaining, 0)
              const changePct = position.prevClose > 0 ? ((position.price - position.prevClose) / position.prevClose) * 100 : 0
              return (
                <div className={clsx('position-item', isOpen && 'is-open', position.quantity <= 0 && 'is-cleared')} key={position.key}>
                  <button
                    type="button"
                    className="position-row"
                    onClick={() => setExpanded(isOpen ? null : position.key)}
                  >
                    <span className="stock-cell">
                      <span className="stock-avatar" style={{ background: position.quantity > 0 ? undefined : '#d8d2c4' }}>
                        {position.name.slice(0, 1)}
                      </span>
                      <span>
                        <strong>
                          {position.name}
                          {risk ? <ShieldAlert size={13} className="risk-inline" /> : null}
                        </strong>
                        <small>{position.symbol} · {position.sector} {locked > 0 ? `· ${locked} 股锁定` : ''}</small>
                      </span>
                    </span>
                    <span className="num">
                      <strong>{formatPrice(position.price)}</strong>
                      <small className={pnlClass(changePct)}>{formatPct(changePct)}</small>
                    </span>
                    <span className="num">
                      <strong>{formatQuantity(position.quantity)} 股</strong>
                      <small>成本 {formatPrice(position.costPrice)}</small>
                    </span>
                    <span className="num">
                      <strong>{formatCurrency(position.marketValue)}</strong>
                      <small>{position.accountName}</small>
                    </span>
                    <span className={clsx('num', pnlClass(position.unrealized))}>
                      <strong>{position.unrealized >= 0 ? '+' : ''}{formatMoney(position.unrealized)}</strong>
                      <small>{formatPct(position.unrealizedPct)}</small>
                    </span>
                    <span className="num">
                      {totals.marketValue > 0 ? `${((position.marketValue / totals.marketValue) * 100).toFixed(1)}%` : '—'}
                    </span>
                    <span className="row-chevron"><ChevronDown size={16} className={isOpen ? 'is-rotated' : undefined} /></span>
                  </button>
                  {isOpen ? (
                    <PositionDetail
                      position={position}
                      onEdit={() => setMetaPosition(position)}
                      onPrice={() => setPricePosition(position)}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <MetaModal key={metaPosition?.key ?? 'meta-closed'} position={metaPosition} onClose={() => setMetaPosition(null)} />
      <PriceModal key={pricePosition?.key ?? 'price-closed'} position={pricePosition} onClose={() => setPricePosition(null)} />
    </div>
  )
}
