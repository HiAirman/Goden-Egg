import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Trade } from '../types'
import { useStore } from '../store/AppStore'
import { buildPositions, feeBreakdown } from '../lib/calc'
import { todayStr } from '../lib/dates'
import {
  isTradingDay,
  isTradingMoment,
  isTradingTime,
  restDayLabel,
  suggestedTradeDate,
  suggestedTradeTime,
} from '../lib/tradingCalendar'
import { formatMoney, round2, safeNumber } from '../lib/format'
import { getStockInfo, searchStocks, sectorForIndustry, type StockInfo } from '../lib/stocks'
import { REASON_TAGS, EMOTIONS } from '../lib/constants'
import { Button, Field, Input, Modal, Select, Textarea } from './ui'
import { useUi } from './UiProvider'
import clsx from 'clsx'

export interface TradeDraft {
  trade?: Trade
  preset?: Partial<Trade>
}

export function TradeModal({
  draft,
  onClose,
}: {
  draft: TradeDraft | null
  onClose: () => void
}) {
  const { state, addTrade, updateTrade, updatePositionMeta } = useStore()
  const { toast } = useUi()
  const allPositions = useMemo(() => buildPositions(state, 'all'), [state])
  const open = Boolean(draft)
  const editing = draft?.trade
  const preset = draft?.preset

  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [accountId, setAccountId] = useState('')
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [fee, setFee] = useState('0')
  const [feeManual, setFeeManual] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState(() => suggestedTradeTime(suggestedTradeDate()))
  const [reasons, setReasons] = useState<string[]>([])
  const [emotion, setEmotion] = useState('冷静')
  const [note, setNote] = useState('')
  const [unlockDate, setUnlockDate] = useState('')
  const [batchLabel, setBatchLabel] = useState('')
  const [stockQuery, setStockQuery] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [error, setError] = useState('')
  const suggestRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const base = editing ?? preset
    const defaultAccount =
      (base?.accountId && state.accounts.some((account) => account.id === base.accountId)
        ? base.accountId
        : state.currentAccountId !== 'all'
          ? state.currentAccountId
          : state.accounts[0]?.id) ?? ''
    setSide(base?.side ?? 'buy')
    setAccountId(defaultAccount)
    setSymbol(base?.symbol ?? '')
    setName(base?.name ?? '')
    setPrice(base?.price ? String(base.price) : '')
    setQuantity(base?.quantity ? String(base.quantity) : '')
    setFee(base?.fee !== undefined ? String(base.fee) : '0')
    setFeeManual(Boolean(editing))
    const initialDate = base?.date ?? suggestedTradeDate()
    setDate(initialDate)
    setTime(base?.time ?? suggestedTradeTime(initialDate))
    setReasons(base?.reasonTags ?? [])
    setEmotion(base?.emotion ?? '冷静')
    setNote(base?.note ?? '')
    setUnlockDate(base?.unlockDate ?? '')
    setBatchLabel(base?.batchLabel ?? '')
    setStockQuery(base?.symbol ? `${base.symbol} ${base.name ?? ''}` : '')
    setSuggestOpen(false)
    setError('')
  }, [open, editing, preset, state.accounts, state.currentAccountId])

  const selectedPosition = useMemo(() => {
    return allPositions.find((position) => position.accountId === accountId && position.symbol === symbol)
  }, [allPositions, accountId, symbol])

  const available = useMemo(() => {
    if (!selectedPosition) return 0
    if (editing?.side === 'sell' && editing.accountId === accountId && editing.symbol === symbol) {
      return selectedPosition.quantity + editing.quantity
    }
    return selectedPosition.quantity
  }, [selectedPosition, editing, accountId, symbol])

  const amount = round2(safeNumber(price) * safeNumber(quantity))
  const autoFees = useMemo(
    () => feeBreakdown(side, safeNumber(price), safeNumber(quantity), state.settings),
    [side, price, quantity, state.settings],
  )

  useEffect(() => {
    if (!feeManual) setFee(String(autoFees.total))
  }, [autoFees.total, feeManual])

  useEffect(() => {
    if (!suggestOpen) return
    const handler = (event: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(event.target as Node)) setSuggestOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [suggestOpen])

  const suggestions = useMemo(() => searchStocks(stockQuery, 12), [stockQuery])

  const chooseStock = (stock: StockInfo) => {
    setSymbol(stock.symbol)
    setName(stock.name)
    setStockQuery(`${stock.symbol} ${stock.name}`)
    setSuggestOpen(false)
  }

  const validate = (): string => {
    if (!accountId) return '请选择账户'
    if (!/^\d{6}$/.test(symbol)) return '请输入 6 位股票代码'
    if (!name.trim()) return '请填写股票名称'
    if (safeNumber(price) <= 0) return '成交价格必须大于 0'
    if (safeNumber(quantity) <= 0 || !Number.isInteger(safeNumber(quantity))) return '成交数量必须是正整数'
    if (side === 'sell' && safeNumber(quantity) > available) return `可卖数量为 ${available} 股`
    if (!date) return '请选择交易日期'
    if (!time) return '请选择交易时间'
    if (!isTradingDay(date)) return `${restDayLabel(date)}，A股不交易，不需要记录交易`
    if (date > todayStr()) return '不能记录未来日期的交易'
    if (!isTradingTime(time)) return 'A股交易时间为 09:30–11:30、13:00–15:00'
    if (!isTradingMoment(date, time)) return '交易时间不能晚于当前时间，也不能在午间休市时段'
    return ''
  }

  const submit = () => {
    const message = validate()
    if (message) {
      setError(message)
      return
    }
    const payload: Omit<Trade, 'id' | 'createdAt'> = {
      accountId,
      symbol,
      name: name.trim(),
      side,
      price: round2(safeNumber(price)),
      quantity: safeNumber(quantity),
      fee: round2(safeNumber(fee)),
      date,
      time,
      reasonTags: reasons,
      emotion,
      note: note.trim(),
      unlockDate: side === 'buy' && unlockDate ? unlockDate : undefined,
      batchLabel: side === 'buy' && batchLabel.trim() ? batchLabel.trim() : undefined,
    }
    if (editing) {
      updateTrade(editing.id, payload)
      toast(`已更新 ${name} 的${side === 'buy' ? '买入' : '卖出'}记录`, 'success')
    } else {
      addTrade(payload)
      toast(`已记录 ${side === 'buy' ? '买入' : '卖出'} ${name} ${quantity} 股`, 'success')
    }
    if (side === 'buy' && !state.positionMeta[`${accountId}::${symbol}`]) {
      const info = getStockInfo(symbol)
      updatePositionMeta(`${accountId}::${symbol}`, {
        sector: info ? sectorForIndustry(info.industry) : '其他',
        thesis: '',
        tags: [],
        updatedAt: Date.now(),
      })
    }
    onClose()
  }

  const chooseAll = () => {
    if (available > 0) setQuantity(String(available))
  }

  const estimateSellPnl = () => {
    if (side !== 'sell' || !selectedPosition) return null
    const qty = safeNumber(quantity)
    if (qty <= 0) return null
    const proceeds = safeNumber(price) * qty - safeNumber(fee)
    const cost = selectedPosition.costPrice * qty
    return proceeds - cost
  }

  const sellEstimate = estimateSellPnl()
  const dateIsRest = Boolean(date) && !isTradingDay(date)
  const timeIsRest = Boolean(time) && !isTradingTime(time)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '编辑交易' : '记录一笔交易'}
      subtitle={editing ? '修改后，持仓成本与已实现盈亏会自动重算。' : '只记录真实发生的成交，复盘才有意义。'}
      width={780}
      footer={
        <>
          <div className="trade-modal-footer-hint">
            {side === 'sell' && selectedPosition ? `当前可卖 ${available} 股` : '数据仅保存在本机'}
          </div>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit}>{editing ? '保存修改' : '保存记录'}</Button>
        </>
      }
    >
      <div className="trade-form">
        <div className="trade-side-switch">
          <button
            type="button"
            className={clsx('trade-side-btn', side === 'buy' && 'is-active is-buy')}
            onClick={() => setSide('buy')}
          >
            买入
          </button>
          <button
            type="button"
            className={clsx('trade-side-btn', side === 'sell' && 'is-active is-sell')}
            onClick={() => setSide('sell')}
          >
            卖出
          </button>
          <span className="trade-side-hint">{side === 'buy' ? '建立或增加仓位' : '按先进先出扣减批次'}</span>
        </div>

        <div className="form-grid form-grid-2">
          <Field label="账户">
            <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {state.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="交易日期 / 时间" hint="A股：09:30–11:30、13:00–15:00，周末与节假日休市">
            <div className="inline-fields">
              <Input type="date" max={todayStr()} value={date} onChange={(event) => setDate(event.target.value)} />
              <Input
                type="time"
                min="09:30"
                max="15:00"
                step="60"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
          </Field>
        </div>

        {dateIsRest || timeIsRest ? (
          <div className="trade-session-warning">
            {dateIsRest
              ? `${restDayLabel(date)}，A股不交易，请选择最近的交易日。`
              : '当前时间不在 A 股连续竞价时段（09:30–11:30、13:00–15:00）。'}
          </div>
        ) : null}

        <div className="form-grid form-grid-stock">
          <Field label="股票 / ETF 代码、名称或拼音" className="stock-search-field">
            <div className="stock-combobox" ref={suggestRef}>
              <Input
                value={stockQuery}
                placeholder="例如 600519 / 510300 / 贵州茅台"
                onChange={(event) => {
                  const value = event.target.value
                  setStockQuery(value)
                  const digits = value.replace(/\D/g, '')
                  if (/^\d{6}$/.test(digits)) {
                    setSymbol(digits)
                    const info = getStockInfo(digits)
                    if (info) setName(info.name)
                  } else {
                    setSymbol('')
                    setName('')
                  }
                  setSuggestOpen(true)
                }}
                onFocus={() => setSuggestOpen(true)}
                autoComplete="off"
              />
              {suggestOpen ? (
                <div className="stock-suggest">
                  {suggestions.length === 0 ? (
                    <div className="stock-suggest-empty">没有匹配的股票或 ETF，可直接填写代码和名称</div>
                  ) : (
                    suggestions.map((stock) => (
                      <button
                        type="button"
                        key={stock.symbol}
                        className="stock-suggest-item"
                        onClick={() => chooseStock(stock)}
                      >
                        <span className="stock-suggest-code">{stock.symbol}</span>
                        <span className="stock-suggest-name">{stock.name}</span>
                        <span className="stock-suggest-industry">{stock.industry}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </Field>
          <Field label="名称">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="自动带出，可修改" />
          </Field>
        </div>

        <div className="form-grid form-grid-3">
          <Field label="成交价">
            <div className="input-affix">
              <span>¥</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
              />
            </div>
          </Field>
          <Field
            label="数量（股）"
            hint={side === 'sell' && selectedPosition ? `可卖 ${available} 股` : undefined}
          >
            <div className="input-with-action">
              <Input
                type="number"
                min="1"
                step="100"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
              />
              {side === 'sell' ? (
                <button type="button" onClick={chooseAll}>
                  全部
                </button>
              ) : null}
            </div>
          </Field>
          <Field label="成交金额">
            <div className="amount-readout">¥ {formatMoney(amount)}</div>
          </Field>
        </div>

        <div className="fee-row">
          <div>
            <span className="fee-label">交易费用</span>
            <span className="fee-detail">
              佣金 ¥{formatMoney(autoFees.commission)} · 过户 ¥{formatMoney(autoFees.transfer)}
              {side === 'sell' ? ` · 印花税 ¥${formatMoney(autoFees.stamp)}` : ''}
            </span>
          </div>
          <div className="fee-input">
            <span>¥</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={fee}
              onChange={(event) => {
                setFeeManual(true)
                setFee(event.target.value)
              }}
            />
            {feeManual ? (
              <button
                type="button"
                className="fee-reset"
                onClick={() => {
                  setFeeManual(false)
                  setFee(String(autoFees.total))
                }}
              >
                恢复自动
              </button>
            ) : null}
          </div>
        </div>

        {side === 'sell' && sellEstimate !== null ? (
          <div className={clsx('sell-estimate', sellEstimate >= 0 ? 'is-up' : 'is-down')}>
            <span>按当前持仓成本估算本次已实现盈亏</span>
            <strong>
              {sellEstimate >= 0 ? '+' : ''}¥ {formatMoney(Math.abs(sellEstimate))}
            </strong>
          </div>
        ) : null}

        {side === 'buy' ? (
          <div className="form-grid form-grid-2 batch-fields">
            <Field label="批次标签" hint="用于股权激励、分批建仓等场景">
              <Input
                value={batchLabel}
                onChange={(event) => setBatchLabel(event.target.value)}
                placeholder="例如 第一期激励 / 底仓"
              />
            </Field>
            <Field label="解禁日期" hint="到期后自动从“锁定”变为“可卖”">
              <Input type="date" value={unlockDate} onChange={(event) => setUnlockDate(event.target.value)} />
            </Field>
          </div>
        ) : null}

        <div className="form-grid form-grid-2">
          <Field label="操作情绪">
            <div className="chip-grid">
              {EMOTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={clsx('chip chip-sm', emotion === item.value && 'is-active')}
                  style={emotion === item.value ? { borderColor: item.color, color: item.color } : undefined}
                  onClick={() => setEmotion(item.value)}
                >
                  {item.value}
                </button>
              ))}
            </div>
          </Field>
          <Field label="操作原因（可多选）">
            <div className="chip-grid">
              {REASON_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={clsx('chip chip-sm', reasons.includes(tag) && 'is-active')}
                  onClick={() =>
                    setReasons((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="交易备注" hint={`${note.length}/300`}>
          <Textarea
            value={note}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
            placeholder="当时看到了什么？为什么在这个位置做这笔交易？"
            rows={3}
          />
        </Field>

        {error ? <div className="form-error">{error}</div> : null}
      </div>
    </Modal>
  )
}
