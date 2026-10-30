import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowLeftRight,
  Download,
  Pencil,
  Plus,
  ReceiptText,
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
  PageHeader,
  SearchInput,
  Segmented,
  Select,
} from '../components/ui'
import type { Trade } from '../types'
import { buildPositions } from '../lib/calc'
import { downloadText, escapeCsv } from '../lib/files'
import { formatCurrency, formatMoney, formatPct, formatPrice, formatQuantity, pnlClass } from '../lib/format'
import { dateShort, todayStr } from '../lib/dates'

export function Trades() {
  const { state, deleteTrade } = useStore()
  const { openTrade, toast } = useUi()
  const allPositions = useMemo(() => buildPositions(state, 'all'), [state])
  const [query, setQuery] = useState('')
  const [side, setSide] = useState<'all' | 'buy' | 'sell'>('all')
  const [account, setAccount] = useState<string>('all')
  const [month, setMonth] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Trade | null>(null)

  const sellMap = useMemo(() => {
    const map = new Map<string, { realized: number; pct: number }>()
    for (const position of allPositions) {
      for (const sell of position.sells) {
        map.set(sell.trade.id, { realized: sell.realized, pct: sell.realizedPct })
      }
    }
    return map
  }, [allPositions])

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    return [...state.trades]
      .filter((trade) => {
        if (side !== 'all' && trade.side !== side) return false
        if (account !== 'all' && trade.accountId !== account) return false
        if (month && !trade.date.startsWith(month)) return false
        if (!text) return true
        return (
          trade.symbol.toLowerCase().includes(text) ||
          trade.name.toLowerCase().includes(text) ||
          trade.note.toLowerCase().includes(text) ||
          trade.reasonTags.some((tag) => tag.toLowerCase().includes(text))
        )
      })
      .sort((a, b) => `${b.date} ${b.time} ${b.createdAt}`.localeCompare(`${a.date} ${a.time} ${a.createdAt}`))
  }, [state.trades, query, side, account, month])

  const totals = useMemo(() => {
    const buys = filtered.filter((trade) => trade.side === 'buy')
    const sells = filtered.filter((trade) => trade.side === 'sell')
    const fees = filtered.reduce((sum, trade) => sum + trade.fee, 0)
    const realized = filtered.reduce((sum, trade) => sum + (sellMap.get(trade.id)?.realized ?? 0), 0)
    return {
      buys: buys.length,
      sells: sells.length,
      fees,
      realized,
      volume: filtered.reduce((sum, trade) => sum + trade.price * trade.quantity, 0),
    }
  }, [filtered, sellMap])

  const months = useMemo(() => {
    const set = new Set(state.trades.map((trade) => trade.date.slice(0, 7)))
    return [...set].sort().reverse()
  }, [state.trades])

  const exportCsv = () => {
    const header = ['日期', '时间', '账户', '代码', '名称', '方向', '价格', '数量', '金额', '费用', '已实现盈亏', '情绪', '原因', '备注']
    const rows = filtered.map((trade) => {
      const accountName = state.accounts.find((item) => item.id === trade.accountId)?.name ?? ''
      return [
        trade.date,
        trade.time,
        accountName,
        trade.symbol,
        trade.name,
        trade.side === 'buy' ? '买入' : '卖出',
        trade.price,
        trade.quantity,
        trade.price * trade.quantity,
        trade.fee,
        sellMap.get(trade.id)?.realized ?? '',
        trade.emotion,
        trade.reasonTags.join('|'),
        trade.note,
      ]
    })
    const content = '\ufeff' + [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')
    downloadText(`GodenEgg-交易流水-${todayStr()}.csv`, content, 'text/csv;charset=utf-8')
    toast('交易流水已导出为 CSV', 'success')
  }

  return (
    <div className="page trades-page">
      <PageHeader
        eyebrow="工作台 / 交易流水"
        title="每一笔买卖，都是你的一面镜子"
        description="按时间、账户和方向筛选，回看当时的判断与情绪。"
        actions={
          <>
            <Button variant="secondary" icon={<Download size={15} />} onClick={exportCsv} disabled={filtered.length === 0}>
              导出 CSV
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => openTrade()}>记录交易</Button>
          </>
        }
      />

      <div className="trade-summary-grid">
        <div><span>筛选内交易</span><strong>{filtered.length} 笔</strong><small>买入 {totals.buys} · 卖出 {totals.sells}</small></div>
        <div><span>成交金额</span><strong>{formatCurrency(totals.volume)}</strong><small>含买卖双边</small></div>
        <div><span>交易费用</span><strong>{formatCurrency(totals.fees)}</strong><small>佣金 + 过户 + 印花税</small></div>
        <div><span>已实现盈亏</span><strong className={pnlClass(totals.realized)}>{totals.realized >= 0 ? '+' : ''}{formatMoney(totals.realized)}</strong><small>按 FIFO 成本计算</small></div>
      </div>

      <Card className="trades-card">
        <div className="trades-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="搜索股票、备注或原因标签" />
          <div className="trades-filters">
            <Segmented
              value={side}
              options={[
                { value: 'all', label: '全部' },
                { value: 'buy', label: '买入' },
                { value: 'sell', label: '卖出' },
              ]}
              onChange={setSide}
            />
            <Select value={account} onChange={(event) => setAccount(event.target.value)}>
              <option value="all">全部账户</option>
              {state.accounts.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
            <Select value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="">全部时间</option>
              {months.map((item) => (
                <option key={item} value={item}>{item.replace('-', ' 年 ')} 月</option>
              ))}
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<ReceiptText size={30} />}
            title={state.trades.length === 0 ? '还没有交易记录' : '没有匹配的交易'}
            description={state.trades.length === 0 ? '先记录一笔真实成交，复盘才有素材。' : '调整筛选条件，或换一个关键词。'}
            action={state.trades.length === 0 ? <Button onClick={() => openTrade()}>记录第一笔交易</Button> : null}
          />
        ) : (
          <div className="table-wrap trades-table-wrap">
            <table className="data-table trades-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>股票</th>
                  <th>方向</th>
                  <th className="num">成交价</th>
                  <th className="num">数量</th>
                  <th className="num">金额</th>
                  <th className="num">费用</th>
                  <th className="num">已实现</th>
                  <th>情绪 / 原因</th>
                  <th>备注</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((trade) => {
                  const sell = sellMap.get(trade.id)
                  const accountName = state.accounts.find((item) => item.id === trade.accountId)?.name
                  return (
                    <tr key={trade.id}>
                      <td>
                        <div className="date-cell">
                          <strong>{dateShort(trade.date)}</strong>
                          <small>{trade.time} · {accountName}</small>
                        </div>
                      </td>
                      <td>
                        <div className="stock-cell">
                          <span className="stock-avatar small">{trade.name.slice(0, 1)}</span>
                          <div>
                            <strong>{trade.name}</strong>
                            <small>{trade.symbol}</small>
                          </div>
                        </div>
                      </td>
                      <td><span className={clsx('side-pill', trade.side)}>{trade.side === 'buy' ? '买入' : '卖出'}</span></td>
                      <td className="num">{formatPrice(trade.price)}</td>
                      <td className="num">{formatQuantity(trade.quantity)}</td>
                      <td className="num">{formatCurrency(trade.price * trade.quantity)}</td>
                      <td className="num muted-num">{formatMoney(trade.fee)}</td>
                      <td className={clsx('num', trade.side === 'sell' && pnlClass(sell?.realized ?? 0))}>
                        {trade.side === 'sell' && sell ? (
                          <>
                            <strong>{sell.realized >= 0 ? '+' : ''}{formatMoney(sell.realized)}</strong>
                            <small>{formatPct(sell.pct)}</small>
                          </>
                        ) : (
                          <span className="muted-num">—</span>
                        )}
                      </td>
                      <td>
                        <div className="tag-stack">
                          <Badge tone="neutral">{trade.emotion}</Badge>
                          {trade.reasonTags.slice(0, 2).map((tag) => <Badge key={tag} tone="green">{tag}</Badge>)}
                          {trade.reasonTags.length > 2 ? <small>+{trade.reasonTags.length - 2}</small> : null}
                        </div>
                      </td>
                      <td className="note-cell" title={trade.note}>{trade.note || '—'}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-btn tiny" onClick={() => openTrade({ trade })} aria-label="编辑交易">
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="icon-btn tiny danger" onClick={() => setPendingDelete(trade)} aria-label="删除交易">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-foot">
          <span><ArrowLeftRight size={13} /> 共 {filtered.length} 笔记录</span>
          <span>卖出盈亏按先进先出（FIFO）自动计算</span>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除这笔交易？"
        description={
          pendingDelete
            ? `将删除 ${pendingDelete.date} 的${pendingDelete.side === 'buy' ? '买入' : '卖出'}记录：${pendingDelete.name} ${pendingDelete.quantity} 股。持仓成本与盈亏会立即重算。`
            : ''
        }
        confirmText="删除交易"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteTrade(pendingDelete.id)
            toast('交易已删除，持仓已重算', 'success')
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
