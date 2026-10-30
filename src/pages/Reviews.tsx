import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Copy,
  Download,
  Flame,
  Lightbulb,
  LoaderCircle,
  NotebookPen,
  Printer,
  Quote,
  Sparkles,
  Star,
  TrendingUp,
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
  Segmented,
  Textarea,
} from '../components/ui'
import type { DailyReview, MarketMood, ReviewIndex, Trade, WeeklyReview } from '../types'
import { chatWithAi } from '../lib/ai'
import { QUOTES } from '../data/quotes'
import { QuoteLine } from '../components/BookQuote'
import {
  isTradingDay,
  nextTradingDay,
  previousTradingDay,
  restDayLabel,
} from '../lib/tradingCalendar'
import { buildPositions } from '../lib/calc'
import { REVIEW_TAGS, INDEX_DEFS } from '../lib/constants'
import {
  dateCN,
  dateShort,
  dateWithWeek,
  isCurrentMonth,
  isToday,
  mondayOf,
  monthMatrix,
  monthTitle,
  shiftDate,
  shiftMonth,
  todayStr,
  weekDays,
  weekLabel,
} from '../lib/dates'
import { downloadText } from '../lib/files'
import { formatCompact, formatMoney, formatPct, pnlClass } from '../lib/format'
import { uid } from '../lib/id'

const MOODS: { value: MarketMood; label: string; note: string }[] = [
  { value: 'bullish', label: '进攻', note: '情绪偏暖，适合持有或加仓' },
  { value: 'neutral', label: '中性', note: '结构行情，控制仓位' },
  { value: 'bearish', label: '防守', note: '情绪偏冷，先保护本金' },
]

const SCORE_LABELS = ['失控', '随意', '一般', '良好', '自律']

function AiReviewModal({
  open,
  onClose,
  date,
  draft,
  dayTrades,
  realized,
}: {
  open: boolean
  onClose: () => void
  date: string
  draft: DailyReview
  dayTrades: Trade[]
  realized: number
}) {
  const { state } = useStore()
  const { toast } = useUi()
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const generate = async () => {
    if (!state.settings.ai.apiKey.trim()) {
      setError('还没有配置 AI API Key。请到「设置 → AI 复盘助手」填写，或关闭窗口继续用本地模板复盘。')
      return
    }
    setLoading(true)
    setError('')
    setContent('')
    const tradeText = dayTrades.length
      ? dayTrades
          .map((trade) => `${trade.side === 'buy' ? '买入' : '卖出'} ${trade.name} ${trade.quantity} 股 @ ${trade.price}，情绪：${trade.emotion}，原因：${trade.reasonTags.join('、') || '未标注'}，备注：${trade.note || '无'}`)
          .join('\n')
      : '今天没有交易。'
    const prompt = [
      `复盘日期：${date}`,
      `当日已实现盈亏：${formatMoney(realized)} 元`,
      `当日交易：\n${tradeText}`,
      `市场判断：${draft.marketNote || '未填写'}`,
      `做得好的地方：${draft.whatWorked || '未填写'}`,
      `做得不好的地方：${draft.whatFailed || '未填写'}`,
      `情绪与纪律：${draft.emotionalState || '未填写'}（纪律评分 ${draft.disciplineScore}/5）`,
      `经验教训：${draft.lessons || '未填写'}`,
      `明日计划：${draft.nextPlan || '未填写'}`,
      '',
      '请以严格但克制的交易复盘教练身份点评。要求：',
      '1. 指出一个最值得保留的动作；',
      '2. 指出一个最危险的模式或盲点；',
      '3. 给出明天可以执行的一条具体规则；',
      '4. 不超过 320 字，不说空泛的鸡汤，不预测股价。',
    ].join('\n')
    try {
      const result = await chatWithAi(state.settings.ai, [
        { role: 'system', content: '你是一位严谨、尊重概率和风险管理的交易复盘教练。你不推荐具体股票，不预测涨跌，只评价流程、纪律和决策质量。' },
        { role: 'user', content: prompt },
      ])
      setContent(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 点评失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setContent('')
    setError('')
    void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const copy = async () => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      toast('AI 点评已复制', 'success')
    } catch {
      toast('复制失败，请手动选择文本', 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<span className="ai-modal-title"><Sparkles size={18} /> AI 复盘教练</span>}
      subtitle="AI 只评价流程与纪律，不预测股价。请勿发送敏感信息。"
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>关闭</Button>
          {content ? (
            <>
              <Button variant="secondary" icon={<Copy size={14} />} onClick={copy}>复制</Button>
              <Button icon={<Sparkles size={14} />} onClick={generate} loading={loading}>重新点评</Button>
            </>
          ) : null}
        </>
      }
    >
      {loading ? (
        <div className="ai-loading">
          <LoaderCircle size={22} className="spin" />
          <span>正在读你的复盘，写一份不客气的点评…</span>
        </div>
      ) : error ? (
        <div className="ai-error">
          <p>{error}</p>
          <a href="#/settings" onClick={onClose}>前往设置 →</a>
        </div>
      ) : content ? (
        <div className="ai-content">{content}</div>
      ) : null}
    </Modal>
  )
}

function ReviewCalendar({
  selected,
  onSelect,
  reviews,
}: {
  selected: string
  onSelect: (date: string) => void
  reviews: DailyReview[]
}) {
  const [month, setMonth] = useState(() => {
    const date = new Date(`${selected}T00:00:00`)
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const days = monthMatrix(month)
  const reviewDates = new Set(reviews.map((review) => review.date))
  return (
    <Card className="review-calendar-card">
      <div className="calendar-head">
        <strong>{monthTitle(month)}</strong>
        <div>
          <button type="button" className="icon-btn tiny" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="上个月">
            <ChevronLeft size={14} />
          </button>
          <button type="button" className="icon-btn tiny" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="下个月">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays">
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const value = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
          const rest = !isTradingDay(value)
          return (
            <button
              type="button"
              key={value}
              title={rest ? restDayLabel(value) : '交易日'}
              className={clsx(
                'calendar-day',
                !isCurrentMonth(day, month) && 'is-outside',
                rest && 'is-rest',
                isToday(day) && 'is-today',
                selected === value && 'is-selected',
                reviewDates.has(value) && 'has-review',
              )}
              onClick={() => {
                onSelect(value)
                if (!isCurrentMonth(day, month)) setMonth(new Date(day.getFullYear(), day.getMonth(), 1))
              }}
            >
              <span>{day.getDate()}</span>
              {reviewDates.has(value) ? <i /> : null}
            </button>
          )
        })}
      </div>
      <div className="calendar-legend">
        <span><i className="legend-dot" /> 已复盘</span>
        <button type="button" onClick={() => onSelect(todayStr())}>回到今天</button>
      </div>
    </Card>
  )
}

function RestDayPanel({
  date,
  onSelectDate,
  onWeekly,
}: {
  date: string
  onSelectDate: (date: string) => void
  onWeekly: () => void
}) {
  const { state } = useStore()
  const existing = state.reviews.find((review) => review.date === date)
  const previous = previousTradingDay(date)
  const next = nextTradingDay(date)
  const label = restDayLabel(date)
  const isToday = date === todayStr()

  return (
    <Card className="rest-day-panel">
      <div className="rest-day-icon"><Coffee size={28} /></div>
      <span className="panel-kicker">{isToday ? '今天' : dateShort(date)}</span>
      <h2>{isToday ? '今天休市，不生成每日复盘。' : `${label}，不生成每日复盘。`}</h2>
      <p>
        {label}，A股不交易，也不产生交易记录。
        可以写本周复盘，或者回看上一个交易日的记录。
      </p>
      {existing ? (
        <div className="rest-day-legacy">
          这一天有 {existing ? '一篇历史复盘记录' : ''}，数据仍保留，但不再新增复盘。
        </div>
      ) : null}
      <div className="rest-day-actions">
        <Button variant="secondary" onClick={() => onSelectDate(previous)}>
          <ChevronLeft size={15} /> 上一交易日 {dateShort(previous)}
        </Button>
        <Button variant="secondary" onClick={() => onSelectDate(next)}>
          下一交易日 {dateShort(next)} <ChevronRight size={15} />
        </Button>
        <Button icon={<BookOpen size={15} />} onClick={onWeekly}>写本周复盘</Button>
      </div>
      <div className="rest-day-foot">
        <CalendarDays size={13} />
        <span>休市日不产生交易和每日复盘，持仓价格保持最近一个交易日收盘。</span>
      </div>
    </Card>
  )
}

function DailyEditor({ date }: { date: string }) {
  const { state, saveReview, deleteReview } = useStore()
  const { toast } = useUi()
  const existing = state.reviews.find((review) => review.date === date)
  const allPositions = useMemo(() => buildPositions(state, 'all'), [state])
  const dayTrades = useMemo(() => state.trades.filter((trade) => trade.date === date), [state.trades, date])
  const daySells = useMemo(
    () => allPositions.flatMap((position) => position.sells.filter((sell) => sell.trade.date === date)),
    [allPositions, date],
  )
  const realized = daySells.reduce((sum, sell) => sum + sell.realized, 0)
  const snapshot = state.snapshots.find((item) => item.date === date)
  const previousSnapshot = [...state.snapshots].filter((item) => item.date < date).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const assetDelta = snapshot && previousSnapshot ? snapshot.totalAssets - previousSnapshot.totalAssets : null

  const initial = useMemo<DailyReview>(() => {
    if (existing) return existing
    const quoteMap = state.quotes
    return {
      id: uid('review'),
      date,
      mood: 'neutral',
      indices: INDEX_DEFS.map((definition) => {
        const quote = quoteMap[definition.code]
        return {
          name: definition.name,
          code: definition.code,
          close: quote?.price ?? 0,
          changePct: quote?.changePct ?? 0,
        }
      }),
      marketNote: '',
      whatWorked: '',
      whatFailed: '',
      lessons: '',
      emotionalState: '',
      nextPlan: '',
      disciplineScore: 3,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }, [date, existing, state.quotes])

  const [draft, setDraft] = useState<DailyReview>(initial)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(existing?.updatedAt ?? null)
  const [aiOpen, setAiOpen] = useState(false)
  const dirtyRef = useRef(false)
  const draftRef = useRef(draft)
  const timer = useRef<number | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    draftRef.current = draft
    dirtyRef.current = dirty
  }, [draft, dirty])

  useEffect(() => {
    if (!dirty) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveReview({ ...draftRef.current, updatedAt: Date.now() })
      setDirty(false)
      dirtyRef.current = false
      setSavedAt(Date.now())
    }, 650)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [draft, dirty, saveReview])

  useEffect(() => {
    return () => {
      if (dirtyRef.current) saveReview({ ...draftRef.current, updatedAt: Date.now() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = (value: Partial<DailyReview>) => {
    setDraft((prev) => ({ ...prev, ...value, updatedAt: Date.now() }))
    setDirty(true)
  }

  const flush = () => {
    saveReview({ ...draft, updatedAt: Date.now() })
    setDirty(false)
    setSavedAt(Date.now())
    toast('复盘已保存', 'success')
  }

  const updateIndex = (index: number, patchIndex: Partial<ReviewIndex>) => {
    const indices = draft.indices.map((item, idx) => (idx === index ? { ...item, ...patchIndex } : item))
    patch({ indices })
  }

  const exportMarkdown = () => {
    const mood = MOODS.find((item) => item.value === draft.mood)?.label ?? '中性'
    const lines = [
      `# ${dateCN(date)} 复盘`,
      '',
      `- 市场温度：${mood}`,
      `- 纪律评分：${draft.disciplineScore}/5 ${SCORE_LABELS[draft.disciplineScore - 1]}`,
      `- 当日交易：${dayTrades.length} 笔，已实现 ${formatMoney(realized)}`,
      '',
      '## 大盘与消息',
      draft.marketNote || '—',
      '',
      '## 今日操作',
      ...(dayTrades.length
        ? dayTrades.map((trade) => `- ${trade.side === 'buy' ? '买入' : '卖出'} ${trade.name} ${trade.quantity} 股 @ ${trade.price}（${trade.emotion}｜${trade.reasonTags.join('、')}）${trade.note ? `：${trade.note}` : ''}`)
        : ['- 今日无交易']),
      '',
      '## 做得好的地方',
      draft.whatWorked || '—',
      '',
      '## 做得不好的地方',
      draft.whatFailed || '—',
      '',
      '## 情绪与纪律',
      draft.emotionalState || '—',
      '',
      '## 经验教训',
      draft.lessons || '—',
      '',
      '## 明日计划',
      draft.nextPlan || '—',
      '',
      `标签：${draft.tags.join('、') || '—'}`,
    ]
    downloadText(`GodenEgg-复盘-${date}.md`, lines.join('\n'), 'text/markdown;charset=utf-8')
    toast('复盘已导出为 Markdown', 'success')
  }

  const today = todayStr()

  return (
    <div className="daily-editor">
      <div className="review-datebar">
        <div>
          <button type="button" className="icon-btn" onClick={() => {
            window.location.hash = `#/reviews?date=${shiftDate(date, -1)}`
          }} aria-label="前一天">
            <ChevronLeft size={17} />
          </button>
          <div className="review-date-main">
            <strong>{dateWithWeek(date)}</strong>
            <small>{existing ? '已记录' : '新的复盘'} · {dayTrades.length} 笔交易</small>
          </div>
          <button type="button" className="icon-btn" onClick={() => {
            window.location.hash = `#/reviews?date=${shiftDate(date, 1)}`
          }} aria-label="后一天">
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="选择日期"
            onClick={() => {
              const input = dateInputRef.current
              if (!input) return
              const picker = input as HTMLInputElement & { showPicker?: () => void }
              if (typeof picker.showPicker === 'function') picker.showPicker()
              else input.click()
            }}
          >
            <CalendarDays size={15} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="hidden-date-input"
            value={date}
            onChange={(event) => {
              if (event.target.value) window.location.hash = `#/reviews?date=${event.target.value}`
            }}
          />
        </div>
        <div className="review-save-state">
          {dirty ? (
            <span className="saving-dot">正在输入…</span>
          ) : savedAt ? (
            <span><Check size={13} /> 已自动保存</span>
          ) : (
            <span>自动保存</span>
          )}
          <Button variant="ghost" size="sm" icon={<Sparkles size={14} />} onClick={() => setAiOpen(true)}>AI 点评</Button>
          <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={exportMarkdown}>导出</Button>
          <Button variant="ghost" size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>打印</Button>
          <Button size="sm" onClick={flush}>保存</Button>
        </div>
      </div>

      <div className="review-stat-grid">
        <div>
          <span>当日已实现</span>
          <strong className={pnlClass(realized)}>{realized >= 0 ? '+' : ''}{formatMoney(realized)}</strong>
          <small>{daySells.length} 笔卖出</small>
        </div>
        <div>
          <span>交易笔数</span>
          <strong>{dayTrades.length}</strong>
          <small>买入 {dayTrades.filter((trade) => trade.side === 'buy').length} · 卖出 {dayTrades.filter((trade) => trade.side === 'sell').length}</small>
        </div>
        <div>
          <span>资产变化（快照）</span>
          <strong className={assetDelta === null ? undefined : pnlClass(assetDelta)}>
            {assetDelta === null ? '—' : `${assetDelta >= 0 ? '+' : ''}${formatMoney(assetDelta)}`}
          </strong>
          <small>{snapshot ? `总资产 ${formatCompact(snapshot.totalAssets)}` : '当天无快照'}</small>
        </div>
        <div>
          <span>复盘状态</span>
          <strong className={existing ? 'is-up' : 'is-flat'}>{existing ? '已完成' : '待完成'}</strong>
          <small>{existing ? `最近更新 ${new Date(existing.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '写下三句话也算开始'}</small>
        </div>
      </div>

      <Card className="review-section mood-section">
        <div className="review-section-head">
          <span className="section-icon"><TrendingUp size={16} /></span>
          <div><h3>市场温度</h3><p>先判断环境，再评价操作。</p></div>
          <div className="mood-switch">
            {MOODS.map((mood) => (
              <button
                type="button"
                key={mood.value}
                className={clsx('mood-btn', `mood-${mood.value}`, draft.mood === mood.value && 'is-active')}
                onClick={() => patch({ mood: mood.value })}
              >
                <strong>{mood.label}</strong>
                <small>{mood.note}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="index-grid">
          {draft.indices.map((index, idx) => (
            <div className="index-input-card" key={index.code}>
              <span>{index.name}</span>
              <div className="inline-fields">
                <Input
                  type="number"
                  step="0.01"
                  value={index.close || ''}
                  placeholder="收盘"
                  onChange={(event) => updateIndex(idx, { close: Number(event.target.value) || 0 })}
                />
                <Input
                  type="number"
                  step="0.01"
                  value={index.changePct || ''}
                  placeholder="涨跌%"
                  onChange={(event) => updateIndex(idx, { changePct: Number(event.target.value) || 0 })}
                />
              </div>
              <small className={pnlClass(index.changePct)}>{index.changePct >= 0 ? '+' : ''}{index.changePct.toFixed(2)}%</small>
            </div>
          ))}
        </div>
        <Field label="大盘、板块与消息面">
          <Textarea
            rows={3}
            value={draft.marketNote}
            onChange={(event) => patch({ marketNote: event.target.value })}
            placeholder="今天指数怎么走？哪些板块强？有什么消息值得记住？"
          />
        </Field>
      </Card>

      <Card className="review-section">
        <div className="review-section-head">
          <span className="section-icon"><NotebookPen size={16} /></span>
          <div><h3>今日操作</h3><p>先还原事实，再评价对错。</p></div>
        </div>
        {dayTrades.length === 0 ? (
          <div className="no-trade-note">今天没有交易。没有交易，也是一种决策。</div>
        ) : (
          <div className="review-trade-list">
            {dayTrades.map((trade) => (
              <div className="review-trade" key={trade.id}>
                <span className={clsx('side-pill', trade.side)}>{trade.side === 'buy' ? '买' : '卖'}</span>
                <strong>{trade.name}</strong>
                <span>{trade.quantity} 股 @ ¥{trade.price}</span>
                <Badge tone="neutral">{trade.emotion}</Badge>
                {trade.reasonTags.map((tag) => <Badge key={tag} tone="green">{tag}</Badge>)}
                <small>{trade.note}</small>
              </div>
            ))}
          </div>
        )}
        <div className="form-grid form-grid-2 review-text-grid">
          <Field label="做得好的地方" hint="具体到动作，不要只写“还行”">
            <Textarea rows={4} value={draft.whatWorked} onChange={(event) => patch({ whatWorked: event.target.value })} placeholder="哪一笔交易执行了计划？哪一次忍住了手？" />
          </Field>
          <Field label="做得不好的地方" hint="对事不对人，找到可改进的动作">
            <Textarea rows={4} value={draft.whatFailed} onChange={(event) => patch({ whatFailed: event.target.value })} placeholder="哪里偏离了计划？是判断错了，还是执行走样了？" />
          </Field>
        </div>
      </Card>

      <Card className="review-section">
        <div className="review-section-head">
          <span className="section-icon"><Flame size={16} /></span>
          <div><h3>情绪与纪律</h3><p>记录当时的情绪与执行偏差。</p></div>
          <div className="discipline-score">
            <span>纪律评分</span>
            <strong>{draft.disciplineScore}<small>/5</small></strong>
            <em>{SCORE_LABELS[draft.disciplineScore - 1]}</em>
          </div>
        </div>
        <div className="score-buttons">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              type="button"
              key={score}
              className={clsx('score-btn', draft.disciplineScore >= score && 'is-active')}
              onClick={() => patch({ disciplineScore: score })}
            >
              <Star size={18} fill={draft.disciplineScore >= score ? 'currentColor' : 'none'} />
              <span>{SCORE_LABELS[score - 1]}</span>
            </button>
          ))}
        </div>
        <Field label="情绪状态">
          <Textarea rows={3} value={draft.emotionalState} onChange={(event) => patch({ emotionalState: event.target.value })} placeholder="今天什么时候最紧张？有没有被分时图带着走？" />
        </Field>
        <div className="review-tag-row">
          {REVIEW_TAGS.map((tag) => (
            <button
              type="button"
              key={tag}
              className={clsx('chip chip-sm', draft.tags.includes(tag) && 'is-active')}
              onClick={() => patch({ tags: draft.tags.includes(tag) ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag] })}
            >
              {tag}
            </button>
          ))}
        </div>
      </Card>

      <Card className="review-section conclusion-section">
        <div className="review-section-head">
          <span className="section-icon"><Lightbulb size={16} /></span>
          <div><h3>把经验变成动作</h3><p>复盘不是写感想，是给下一次决策写说明书。</p></div>
        </div>
        <Field label="经验教训">
          <Textarea rows={3} value={draft.lessons} onChange={(event) => patch({ lessons: event.target.value })} placeholder="如果明天遇到类似情况，我会怎么做？" />
        </Field>
        <Field label="明日计划">
          <Textarea rows={4} value={draft.nextPlan} onChange={(event) => patch({ nextPlan: event.target.value })} placeholder="关注什么？什么价位做什么动作？什么情况下不交易？" />
        </Field>
        <div className="conclusion-foot">
          <span>{dirty ? '有未保存的修改' : savedAt ? '所有修改已保存到本机' : '开始输入后自动保存'}</span>
          <div>
            {existing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm(`删除 ${dateCN(date)} 的复盘？`)) {
                    deleteReview(date)
                    toast('复盘已删除', 'success')
                  }
                }}
              >
                删除这篇
              </Button>
            ) : null}
            <Button size="sm" onClick={flush}>保存复盘</Button>
          </div>
        </div>
      </Card>
      <div className="review-print-foot">Goden Egg · 会生金蛋的鸡 · {dateCN(date)}</div>
      <AiReviewModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        date={date}
        draft={draft}
        dayTrades={dayTrades}
        realized={realized}
      />
    </div>
  )
}

function WeeklyEditor({ weekStart }: { weekStart: string }) {
  const { state, saveWeeklyReview } = useStore()
  const { toast } = useUi()
  const existing = state.weeklyReviews.find((review) => review.weekStart === weekStart)
  const allPositions = useMemo(() => buildPositions(state, 'all'), [state])
  const days = weekDays(weekStart)
  const weekTrades = state.trades.filter((trade) => trade.date >= days[0] && trade.date <= days[6])
  const weekSells = allPositions.flatMap((position) => position.sells.filter((sell) => sell.trade.date >= days[0] && sell.trade.date <= days[6]))
  const realized = weekSells.reduce((sum, sell) => sum + sell.realized, 0)
  const wins = weekSells.filter((sell) => sell.realized > 0).length
  const losses = weekSells.filter((sell) => sell.realized < 0).length
  const reviews = state.reviews.filter((review) => review.date >= days[0] && review.date <= days[6])
  const initial = useMemo<WeeklyReview>(
    () =>
      existing ?? {
        id: uid('weekly'),
        weekStart,
        summary: '',
        marketReview: '',
        mistakes: '',
        nextWeekPlan: '',
        disciplineScore: 3,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    [existing, weekStart],
  )
  const [draft, setDraft] = useState<WeeklyReview>(initial)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(existing?.updatedAt ?? null)
  const dirtyRef = useRef(false)
  const draftRef = useRef(draft)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    draftRef.current = draft
    dirtyRef.current = dirty
  }, [draft, dirty])

  useEffect(() => {
    if (!dirty) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveWeeklyReview({ ...draftRef.current, updatedAt: Date.now() })
      setDirty(false)
      dirtyRef.current = false
      setSavedAt(Date.now())
    }, 650)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [draft, dirty, saveWeeklyReview])

  useEffect(() => {
    return () => {
      if (dirtyRef.current) saveWeeklyReview({ ...draftRef.current, updatedAt: Date.now() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = (value: Partial<WeeklyReview>) => {
    setDraft((prev) => ({ ...prev, ...value, updatedAt: Date.now() }))
    setDirty(true)
  }

  const flush = () => {
    saveWeeklyReview({ ...draft, updatedAt: Date.now() })
    setDirty(false)
    setSavedAt(Date.now())
    toast('周复盘已保存', 'success')
  }

  return (
    <div className="daily-editor">
      <div className="review-datebar">
        <div>
          <button type="button" className="icon-btn" aria-label="上一周" onClick={() => {
            window.location.hash = `#/reviews?week=${shiftDate(weekStart, -7)}`
          }}><ChevronLeft size={17} /></button>
          <div className="review-date-main">
            <strong>{weekLabel(weekStart)} 周复盘</strong>
            <small>{reviews.length} 篇日记 · {weekTrades.length} 笔交易</small>
          </div>
          <button type="button" className="icon-btn" aria-label="下一周" onClick={() => {
            window.location.hash = `#/reviews?week=${shiftDate(weekStart, 7)}`
          }}><ChevronRight size={17} /></button>
        </div>
        <div className="review-save-state">
          {dirty ? <span className="saving-dot">正在输入…</span> : savedAt ? <span><Check size={13} /> 已保存</span> : <span>自动保存</span>}
          <Button size="sm" onClick={flush}>保存周复盘</Button>
        </div>
      </div>

      <div className="review-stat-grid">
        <div><span>本周已实现</span><strong className={pnlClass(realized)}>{realized >= 0 ? '+' : ''}{formatMoney(realized)}</strong><small>{weekSells.length} 笔卖出</small></div>
        <div><span>交易胜率</span><strong>{wins + losses > 0 ? `${((wins / (wins + losses)) * 100).toFixed(0)}%` : '—'}</strong><small>{wins} 胜 / {losses} 负</small></div>
        <div><span>交易频率</span><strong>{weekTrades.length} 笔</strong><small>日均 {(weekTrades.length / 5).toFixed(1)} 笔</small></div>
        <div><span>复盘完成</span><strong>{reviews.length} / 5</strong><small>工作日复盘</small></div>
      </div>

      <Card className="review-section">
        <div className="review-section-head">
          <span className="section-icon"><Quote size={16} /></span>
          <div><h3>本周一句话总结</h3><p>如果只能用一句话概括这周，会是什么？</p></div>
        </div>
        <Textarea rows={4} value={draft.summary} onChange={(event) => patch({ summary: event.target.value })} placeholder="这周最重要的判断是什么？做对了什么，又重复了什么错误？" />
      </Card>

      <div className="form-grid form-grid-2">
        <Card className="review-section">
          <div className="review-section-head compact">
            <span className="section-icon"><TrendingUp size={16} /></span>
            <div><h3>市场回顾</h3></div>
          </div>
          <Textarea rows={5} value={draft.marketReview} onChange={(event) => patch({ marketReview: event.target.value })} placeholder="指数、量能、主线板块和情绪变化。" />
        </Card>
        <Card className="review-section">
          <div className="review-section-head compact">
            <span className="section-icon"><Flame size={16} /></span>
            <div><h3>本周最大失误</h3></div>
          </div>
          <Textarea rows={5} value={draft.mistakes} onChange={(event) => patch({ mistakes: event.target.value })} placeholder="哪个动作最值得警惕？下次如何避免？" />
        </Card>
      </div>

      <Card className="review-section">
        <div className="review-section-head">
          <span className="section-icon"><Lightbulb size={16} /></span>
          <div><h3>下周计划</h3><p>把注意力放在少数重要的事情上。</p></div>
        </div>
        <Textarea rows={5} value={draft.nextWeekPlan} onChange={(event) => patch({ nextWeekPlan: event.target.value })} placeholder="仓位计划、关注标的、需要验证的逻辑、明确的禁区。" />
        <div className="discipline-score inline-score">
          <span>本周纪律评分</span>
          <strong>{draft.disciplineScore}<small>/5</small></strong>
        </div>
        <div className="score-buttons">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              type="button"
              key={score}
              className={clsx('score-btn', draft.disciplineScore >= score && 'is-active')}
              onClick={() => patch({ disciplineScore: score })}
            >
              <Star size={18} fill={draft.disciplineScore >= score ? 'currentColor' : 'none'} />
              <span>{SCORE_LABELS[score - 1]}</span>
            </button>
          ))}
        </div>
        <div className="review-tag-row">
          {REVIEW_TAGS.map((tag) => (
            <button
              type="button"
              key={tag}
              className={clsx('chip chip-sm', draft.tags.includes(tag) && 'is-active')}
              onClick={() => patch({ tags: draft.tags.includes(tag) ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag] })}
            >
              {tag}
            </button>
          ))}
        </div>
      </Card>

      <Card className="review-section">
        <div className="review-section-head">
          <span className="section-icon"><CalendarDays size={16} /></span>
          <div><h3>本周复盘索引</h3><p>点开任意一天，继续补充细节。</p></div>
        </div>
        <div className="week-review-index">
          {days.map((day) => {
            const review = state.reviews.find((item) => item.date === day)
            return (
              <a key={day} href={`#/reviews?date=${day}`} className={clsx('week-day-card', review && 'has-review', isToday(new Date(`${day}T00:00:00`)) && 'is-today')}>
                <span>{dateShort(day)}</span>
                <strong>{review ? MOODS.find((mood) => mood.value === review.mood)?.label : '未复盘'}</strong>
                <small>{review?.lessons || review?.marketNote || '—'}</small>
              </a>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

export function Reviews() {
  const { state } = useStore()
  const hash = window.location.hash
  const initialDate = new URLSearchParams(hash.split('?')[1] ?? '').get('date') ?? todayStr()
  const initialWeek = new URLSearchParams(hash.split('?')[1] ?? '').get('week') ?? mondayOf(todayStr())
  const [tab, setTab] = useState<'daily' | 'weekly'>(hash.includes('week=') ? 'weekly' : 'daily')
  const [date, setDate] = useState(initialDate)
  const [weekStart, setWeekStart] = useState(mondayOf(initialWeek))
  const recent = [...state.reviews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)

  const selectDate = (value: string) => {
    setDate(value)
    window.history.replaceState(null, '', `#/reviews?date=${value}`)
  }

  return (
    <div className="page reviews-page">
      <PageHeader
        eyebrow="复盘与迭代"
        title="复盘记录"
        description={<QuoteLine quote={QUOTES.marksPrepare} />}
        actions={
          <div className="review-header-actions">
            <Badge tone="green"><Flame size={12} /> 共 {state.reviews.length} 篇记录</Badge>
            <Segmented
              value={tab}
              options={[
                { value: 'daily', label: '每日复盘' },
                { value: 'weekly', label: '每周复盘' },
              ]}
              onChange={setTab}
            />
          </div>
        }
      />

      <div className="review-layout">
        <aside className="review-aside">
          <ReviewCalendar selected={date} onSelect={selectDate} reviews={state.reviews} />
          <Card className="recent-reviews-card">
            <div className="aside-head">
              <strong>最近复盘</strong>
              <BookOpen size={15} />
            </div>
            {recent.length === 0 ? (
              <p className="muted-text small">还没有复盘记录。</p>
            ) : (
              recent.map((review) => (
                <button
                  type="button"
                  className={clsx('recent-review-item', review.date === date && tab === 'daily' && 'is-active')}
                  key={review.id}
                  onClick={() => {
                    setDate(review.date)
                    setTab('daily')
                  }}
                >
                  <span>
                    <strong>{dateShort(review.date)}</strong>
                    <small>{MOODS.find((mood) => mood.value === review.mood)?.label} · {review.disciplineScore}/5</small>
                  </span>
                  <p>{review.lessons || review.marketNote || '—'}</p>
                </button>
              ))
            )}
          </Card>
          <Card className="weekly-cta-card">
            <Sparkles size={18} />
            <strong>每周复盘</strong>
            <p>把五天的碎片，拼成一张完整的地图。</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setTab('weekly')
                setWeekStart(mondayOf(todayStr()))
              }}
            >
              开始本周复盘 <ArrowRight size={14} />
            </Button>
          </Card>
        </aside>

        <div className="review-main">
          {tab === 'daily' ? (
            isTradingDay(date) ? (
              <DailyEditor key={date} date={date} />
            ) : (
              <RestDayPanel
                date={date}
                onSelectDate={selectDate}
                onWeekly={() => {
                  setTab('weekly')
                  setWeekStart(mondayOf(date))
                }}
              />
            )
          ) : (
            <WeeklyEditor key={weekStart} weekStart={weekStart} />
          )}
        </div>
      </div>
    </div>
  )
}
