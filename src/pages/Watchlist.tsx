import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowUpRight,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Target,
  Trash2,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { useUi } from '../components/UiProvider'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Textarea,
} from '../components/ui'
import type { WatchItem } from '../types'
import { formatPrice, pnlClass, safeNumber } from '../lib/format'
import { QUOTES } from '../data/quotes'
import { QuoteLine } from '../components/BookQuote'
import { getStockInfo, searchStocks, type StockInfo } from '../lib/stocks'

function WatchModal({
  open,
  initial,
  onClose,
}: {
  open: boolean
  initial: WatchItem | null
  onClose: () => void
}) {
  const { addWatch, updateWatch } = useStore()
  const { toast } = useUi()
  const [query, setQuery] = useState(initial ? `${initial.symbol} ${initial.name}` : '')
  const [symbol, setSymbol] = useState(initial?.symbol ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [target, setTarget] = useState(initial?.targetPrice ? String(initial.targetPrice) : '')
  const [stop, setStop] = useState(initial?.stopLoss ? String(initial.stopLoss) : '')
  const [thesis, setThesis] = useState(initial?.thesis ?? '')
  const [tags, setTags] = useState((initial?.tags ?? []).join('，'))
  const [suggest, setSuggest] = useState(false)
  const [error, setError] = useState('')
  const suggestions = useMemo(() => searchStocks(query, 10), [query])

  const choose = (stock: StockInfo) => {
    setSymbol(stock.symbol)
    setName(stock.name)
    setQuery(`${stock.symbol} ${stock.name}`)
    setSuggest(false)
  }

  const submit = () => {
    if (!/^\d{6}$/.test(symbol)) return setError('请输入 6 位股票代码')
    if (!name.trim()) return setError('请填写股票名称')
    const payload = {
      symbol,
      name: name.trim(),
      targetPrice: safeNumber(target) > 0 ? safeNumber(target) : undefined,
      stopLoss: safeNumber(stop) > 0 ? safeNumber(stop) : undefined,
      thesis: thesis.trim(),
      tags: tags.split(/[，,、\s]+/).map((tag) => tag.trim()).filter(Boolean),
    }
    if (initial) {
      updateWatch(initial.id, payload)
      toast('自选股已更新', 'success')
    } else {
      addWatch(payload)
      toast('已加入自选池', 'success')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? '编辑自选股' : '加入自选池'}
      subtitle="先写下关注逻辑，再等价格走到你的位置。"
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={submit}>{initial ? '保存修改' : '加入自选'}</Button>
        </>
      }
    >
      <Field label="股票 / ETF 代码、名称或拼音">
        <div className="stock-combobox">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSymbol('')
              setName('')
              setSuggest(true)
            }}
            onFocus={() => setSuggest(true)}
            placeholder="搜索股票/ETF，例如 510300 / 沪深300ETF"
            autoComplete="off"
          />
          {suggest ? (
            <div className="stock-suggest">
              {suggestions.length === 0 ? <div className="stock-suggest-empty">没有匹配结果</div> : suggestions.map((stock) => (
                <button type="button" key={stock.symbol} className="stock-suggest-item" onClick={() => choose(stock)}>
                  <span className="stock-suggest-code">{stock.symbol}</span>
                  <span className="stock-suggest-name">{stock.name}</span>
                  <span className="stock-suggest-industry">{stock.industry}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </Field>
      <div className="form-grid form-grid-2">
        <Field label="股票代码">
          <Input
            value={symbol}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '').slice(0, 6)
              setSymbol(value)
              if (value.length === 6) {
                const info = getStockInfo(value)
                if (info && !name) setName(info.name)
              }
            }}
            placeholder="600519"
          />
        </Field>
        <Field label="股票名称">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="贵州茅台" />
        </Field>
      </div>
      <div className="form-grid form-grid-2">
        <Field label="目标价" hint="到了提醒自己检查逻辑">
          <div className="input-affix"><span>¥</span><Input type="number" step="0.01" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0.00" /></div>
        </Field>
        <Field label="止损价" hint="跌破就重新评估">
          <div className="input-affix"><span>¥</span><Input type="number" step="0.01" value={stop} onChange={(event) => setStop(event.target.value)} placeholder="0.00" /></div>
        </Field>
      </div>
      <Field label="关注逻辑">
        <Textarea rows={3} value={thesis} onChange={(event) => setThesis(event.target.value)} placeholder="为什么关注？什么信号出现才会买？" />
      </Field>
      <Field label="标签" hint="逗号分隔">
        <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="AI，半导体，回调关注" />
      </Field>
      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  )
}

export function Watchlist() {
  const { state, refreshQuotes } = useStore()
  const { openTrade, toast } = useUi()
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WatchItem | null>(null)
  const [deleting, setDeleting] = useState<WatchItem | null>(null)
  const { deleteWatch } = useStore()

  const filtered = state.watchlist.filter((item) => {
    const text = query.trim().toLowerCase()
    if (!text) return true
    return item.symbol.includes(text) || item.name.toLowerCase().includes(text) || item.tags.some((tag) => tag.toLowerCase().includes(text))
  })

  const refresh = async () => {
    const result = await refreshQuotes()
    toast(result.ok ? '自选股行情已更新' : result.error || '行情刷新失败', result.ok ? 'success' : 'error')
  }

  return (
    <div className="page watchlist-page">
      <PageHeader
        eyebrow="工具箱 / 自选池"
        title="自选池"
        description={<QuoteLine quote={QUOTES.mungerWait} />}
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={refresh}>刷新行情</Button>
            <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setModalOpen(true) }}>添加自选</Button>
          </>
        }
      />

      <div className="list-toolbar standalone">
        <SearchInput value={query} onChange={setQuery} placeholder="搜索自选股或标签" />
        <Badge tone="neutral"><Star size={12} /> {state.watchlist.length} 只自选</Badge>
      </div>

      {filtered.length === 0 ? (
        <Card className="panel">
          <EmptyState
            icon={<Star size={30} />}
            title={state.watchlist.length === 0 ? '自选池还是空的' : '没有匹配的自选股'}
            description={state.watchlist.length === 0 ? '把想买的股票放进来，写上目标价和关注逻辑。' : '换个关键词试试。'}
            action={state.watchlist.length === 0 ? <Button onClick={() => { setEditing(null); setModalOpen(true) }}>添加第一只</Button> : null}
          />
        </Card>
      ) : (
        <div className="watch-grid">
          {filtered.map((item) => {
            const quote = state.quotes[item.symbol]
            const price = quote?.price
            const atTarget = price && item.targetPrice && price >= item.targetPrice
            const belowStop = price && item.stopLoss && price <= item.stopLoss
            const nearTarget = price && item.targetPrice && price < item.targetPrice && (item.targetPrice - price) / price <= 0.03
            return (
              <Card className={clsx('watch-card', belowStop && 'is-risk')} key={item.id}>
                <div className="watch-card-head">
                  <div className="watch-title">
                    <span className="stock-avatar">{item.name.slice(0, 1)}</span>
                    <div>
                      <h3>{item.name}</h3>
                      <span>{item.symbol} <i>·</i> {quote ? '实时行情' : '待刷新'}</span>
                    </div>
                  </div>
                  <div className="watch-price">
                    <strong>{price ? formatPrice(price) : '—'}</strong>
                    <small className={quote ? pnlClass(quote.changePct) : undefined}>
                      {quote ? `${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}%` : '暂无行情'}
                    </small>
                  </div>
                </div>

                <div className="watch-levels">
                  <div>
                    <span><Target size={12} /> 目标价</span>
                    <strong>{item.targetPrice ? `¥ ${formatPrice(item.targetPrice)}` : '未设置'}</strong>
                  </div>
                  <div>
                    <span><ShieldIcon /> 止损价</span>
                    <strong>{item.stopLoss ? `¥ ${formatPrice(item.stopLoss)}` : '未设置'}</strong>
                  </div>
                  <div className="watch-status">
                    {atTarget ? <Badge tone="up">已到目标</Badge> : belowStop ? <Badge tone="down">跌破止损</Badge> : nearTarget ? <Badge tone="gold">接近目标</Badge> : <Badge tone="neutral">等待中</Badge>}
                  </div>
                </div>

                <p className="watch-thesis">{item.thesis || '还没有写下关注逻辑。'}</p>
                <div className="watch-tags">
                  {item.tags.map((tag) => <Badge key={tag} tone="green">{tag}</Badge>)}
                </div>

                <div className="watch-foot">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ArrowUpRight size={14} />}
                    onClick={() => openTrade({ preset: { symbol: item.symbol, name: item.name, side: 'buy', price: price ?? undefined } })}
                  >
                    记录买入
                  </Button>
                  <div className="row-actions">
                    <button type="button" className="icon-btn tiny" onClick={() => { setEditing(item); setModalOpen(true) }} aria-label="编辑"><Pencil size={14} /></button>
                    <button type="button" className="icon-btn tiny danger" onClick={() => setDeleting(item)} aria-label="删除"><Trash2 size={14} /></button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <WatchModal
        key={`${editing?.id ?? 'new'}-${modalOpen}`}
        open={modalOpen}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null) }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="从自选池移除？"
        description={deleting ? `将移除 ${deleting.name}（${deleting.symbol}）。持仓和交易记录不受影响。` : ''}
        confirmText="移除"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteWatch(deleting.id)
            toast('已从自选池移除', 'success')
          }
          setDeleting(null)
        }}
      />
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}
