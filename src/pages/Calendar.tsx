import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Pencil,
  Plus,
  Trash2,
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
  Select,
  Textarea,
} from '../components/ui'
import type { AppState, CalendarEvent, EventType } from '../types'
import { buildPositions } from '../lib/calc'
import { EVENT_COLORS, EVENT_LABELS } from '../lib/constants'
import { isTradingDay, restDayLabel } from '../lib/tradingCalendar'
import {
  dateCN,
  dateWithWeek,
  isCurrentMonth,
  isToday,
  monthMatrix,
  monthTitle,
  shiftMonth,
  todayStr,
} from '../lib/dates'
import { formatPrice, formatQuantity } from '../lib/format'

interface DayItem {
  id: string
  date: string
  time?: string
  title: string
  subtitle?: string
  type: EventType
  note?: string
  symbol?: string
  event?: CalendarEvent
  auto?: boolean
}

function EventModal({
  open,
  initial,
  defaultDate,
  onClose,
}: {
  open: boolean
  initial: CalendarEvent | null
  defaultDate: string
  onClose: () => void
}) {
  const { addEvent, updateEvent } = useStore()
  const { toast } = useUi()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [time, setTime] = useState(initial?.time ?? '')
  const [type, setType] = useState<EventType>(initial?.type ?? 'custom')
  const [symbol, setSymbol] = useState(initial?.symbol ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  const submit = () => {
    if (!title.trim()) return setError('请填写事件标题')
    if (!date) return setError('请选择日期')
    const payload = {
      title: title.trim(),
      date,
      time: time || undefined,
      type,
      symbol: symbol.trim() || undefined,
      note: note.trim() || undefined,
    }
    if (initial) {
      updateEvent(initial.id, payload)
      toast('事件已更新', 'success')
    } else {
      addEvent(payload)
      toast('事件已添加到日历', 'success')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? '编辑事件' : '添加日历事件'}
      subtitle="把重要的日子提前放进日历，别让临时反应代替计划。"
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={submit}>{initial ? '保存修改' : '添加事件'}</Button>
        </>
      }
    >
      <div className="form-grid form-grid-2">
        <Field label="日期">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="时间" hint="可选">
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </Field>
      </div>
      <Field label="事件标题">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：中际旭创三季报" maxLength={60} />
      </Field>
      <div className="form-grid form-grid-2">
        <Field label="类型">
          <Select value={type} onChange={(event) => setType(event.target.value as EventType)}>
            {Object.entries(EVENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="关联股票代码" hint="可选">
          <Input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="600519" />
        </Field>
      </div>
      <Field label="备注">
        <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="要关注什么？什么情况下采取行动？" />
      </Field>
      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  )
}

export function Calendar() {
  const { state, deleteEvent } = useStore()
  const { toast } = useUi()
  const [month, setMonth] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [filters, setFilters] = useState<Set<EventType>>(new Set(['review', 'trade', 'earnings', 'unlock', 'macro', 'custom']))
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)

  const allItems = useMemo<DayItem[]>(() => {
    const items: DayItem[] = []
    for (const review of state.reviews) {
      items.push({
        id: `review_${review.id}`,
        date: review.date,
        title: '每日复盘',
        subtitle: `${review.disciplineScore}/5 纪律 · ${review.marketNote.slice(0, 22) || '已记录'}`,
        type: 'review',
        auto: true,
      })
    }
    for (const trade of state.trades) {
      items.push({
        id: `trade_${trade.id}`,
        date: trade.date,
        time: trade.time,
        title: `${trade.side === 'buy' ? '买入' : '卖出'} ${trade.name}`,
        subtitle: `${formatQuantity(trade.quantity)} 股 @ ¥${formatPrice(trade.price)}`,
        type: 'trade',
        auto: true,
      })
    }
    for (const event of state.events) {
      items.push({
        id: `event_${event.id}`,
        date: event.date,
        time: event.time,
        title: event.title,
        subtitle: event.note,
        type: event.type,
        symbol: event.symbol,
        event,
      })
    }
    for (const position of buildUnlocks(state)) {
      items.push(position)
    }
    return items
  }, [state])

  const filtered = allItems.filter((item) => filters.has(item.type))
  const dayItems = (date: string) => filtered.filter((item) => item.date === date).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const selectedItems = dayItems(selectedDate)
  const days = monthMatrix(month)
  const upcoming = [...filtered]
    .filter((item) => item.date >= todayStr())
    .sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))
    .slice(0, 6)

  const toggleFilter = (type: EventType) => {
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  return (
    <div className="page calendar-page">
      <PageHeader
        eyebrow="复盘与迭代 / 日历"
        title="事件日历"
        description="财报、解禁、宏观事件与复盘计划集中在这里。"
        actions={<Button icon={<Plus size={16} />} onClick={openCreate}>添加事件</Button>}
      />

      <div className="calendar-layout">
        <Card className="full-calendar-card">
          <div className="full-calendar-head">
            <div className="calendar-title-block">
              <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="上个月"><ChevronLeft size={18} /></button>
              <h2>{monthTitle(month)}</h2>
              <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="下个月"><ChevronRight size={18} /></button>
              <Button size="sm" variant="ghost" onClick={() => {
                const now = new Date()
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
                setSelectedDate(todayStr())
              }}>今天</Button>
            </div>
            <div className="calendar-filters">
              {(Object.keys(EVENT_LABELS) as EventType[]).map((type) => (
                <button
                  type="button"
                  key={type}
                  className={clsx('calendar-filter', filters.has(type) && 'is-active')}
                  onClick={() => toggleFilter(type)}
                >
                  <i style={{ background: EVENT_COLORS[type] }} />
                  {EVENT_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="full-calendar-weekdays">
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="full-calendar-grid">
            {days.map((day) => {
              const value = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
              const items = dayItems(value)
              const rest = !isTradingDay(value)
              return (
                <button
                  type="button"
                  key={value}
                  title={rest ? restDayLabel(value) : 'A股交易日'}
                  className={clsx(
                    'full-calendar-day',
                    !isCurrentMonth(day, month) && 'is-outside',
                    rest && 'is-rest',
                    isToday(day) && 'is-today',
                    selectedDate === value && 'is-selected',
                  )}
                  onClick={() => {
                    setSelectedDate(value)
                    if (!isCurrentMonth(day, month)) setMonth(new Date(day.getFullYear(), day.getMonth(), 1))
                  }}
                >
                  <span className="day-number">{day.getDate()}</span>
                  <span className="day-events">
                    {items.slice(0, 3).map((item) => (
                      <span className="day-event" key={item.id}>
                        <i style={{ background: EVENT_COLORS[item.type] }} />
                        <span>{item.time ? `${item.time} ` : ''}{item.title}</span>
                      </span>
                    ))}
                    {items.length > 3 ? <small>还有 {items.length - 3} 项</small> : null}
                    {rest && items.length === 0 ? <span className="day-rest-label">休市</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <div className="calendar-side">
          <Card className="day-detail-card">
            <div className="aside-head">
              <div>
                <strong>{dateCN(selectedDate)}</strong>
                <small>{dateWithWeek(selectedDate)}</small>
              </div>
              <button type="button" className="icon-btn tiny" onClick={openCreate} aria-label="添加事件"><Plus size={15} /></button>
            </div>
            {selectedItems.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarDays size={24} />}
                title="这一天没有安排"
                description="可以添加一个事件，或去写一篇复盘。"
                action={<Button size="sm" variant="secondary" onClick={openCreate}>添加事件</Button>}
              />
            ) : (
              <div className="day-item-list">
                {selectedItems.map((item) => (
                  <div className="day-item" key={item.id}>
                    <span className="day-item-dot" style={{ background: EVENT_COLORS[item.type] }} />
                    <div className="day-item-body">
                      <div className="day-item-title">
                        <strong>{item.title}</strong>
                        {item.time ? <small><Clock3 size={11} /> {item.time}</small> : null}
                      </div>
                      {item.subtitle ? <p>{item.subtitle}</p> : null}
                      <div className="day-item-foot">
                        <Badge tone="neutral">{EVENT_LABELS[item.type]}</Badge>
                        {item.event ? (
                          <span className="day-item-actions">
                            <button type="button" onClick={() => { setEditing(item.event!); setModalOpen(true) }}><Pencil size={12} /> 编辑</button>
                            <button type="button" onClick={() => {
                              if (window.confirm(`删除事件「${item.title}」？`)) {
                                deleteEvent(item.event!.id)
                                toast('事件已删除', 'success')
                              }
                            }}><Trash2 size={12} /> 删除</button>
                          </span>
                        ) : item.type === 'review' ? (
                          <a href={`#/reviews?date=${item.date}`}>去复盘</a>
                        ) : item.type === 'trade' ? (
                          <a href="#/trades">看流水</a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="upcoming-card">
            <div className="aside-head">
              <strong>接下来</strong>
              <CircleDot size={15} />
            </div>
            {upcoming.length === 0 ? (
              <p className="muted-text small">未来没有安排。</p>
            ) : (
              upcoming.map((item) => (
                <button type="button" className="upcoming-row" key={item.id} onClick={() => {
                  setSelectedDate(item.date)
                  setMonth(new Date(`${item.date}T00:00:00`))
                }}>
                  <span className="upcoming-date">{item.date.slice(5)}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{EVENT_LABELS[item.type]} {item.time ?? ''}</small>
                  </span>
                  <i style={{ background: EVENT_COLORS[item.type] }} />
                </button>
              ))
            )}
          </Card>
        </div>
      </div>

      <EventModal
        key={`${editing?.id ?? 'new'}-${modalOpen}`}
        open={modalOpen}
        initial={editing}
        defaultDate={selectedDate}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

function buildUnlocks(state: AppState): DayItem[] {
  const result: DayItem[] = []
  for (const position of buildPositions(state, 'all')) {
    for (const lot of position.lots) {
      if (lot.remaining <= 0 || !lot.unlockDate) continue
      result.push({
        id: `unlock_${lot.id}`,
        date: lot.unlockDate,
        title: `${position.name} 解禁`,
        subtitle: `批次「${lot.batchLabel || '普通买入'}」${formatQuantity(lot.remaining)} 股可卖`,
        type: 'unlock',
        symbol: position.symbol,
        auto: true,
      })
    }
  }
  return result
}
