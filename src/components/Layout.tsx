import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  HardDrive,
  LayoutDashboard,
  Menu,
  NotebookPen,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useStore } from '../store/AppStore'
import { useUi } from './UiProvider'
import { formatCurrency, formatMoney } from '../lib/format'
import { dateWithWeek, todayStr } from '../lib/dates'
import { relativeTime } from '../lib/dates'
import { Button, IconButton, useOutsideClick } from './ui'

export type PageKey =
  | 'dashboard'
  | 'positions'
  | 'trades'
  | 'reviews'
  | 'analytics'
  | 'calendar'
  | 'watchlist'
  | 'tools'
  | 'learning'
  | 'settings'

export const PAGE_META: Record<PageKey, { title: string; eyebrow: string; description: string }> = {
  dashboard: { title: '总览', eyebrow: '工作台', description: '总资产、持仓、交易与复盘的日常入口。' },
  positions: { title: '持仓', eyebrow: '工作台', description: '成本、批次、止损与目标价。' },
  trades: { title: '交易流水', eyebrow: '工作台', description: '成交记录、费用与操作标签。' },
  reviews: { title: '复盘', eyebrow: '复盘与迭代', description: '每日与每周复盘记录。' },
  analytics: { title: '分析', eyebrow: '复盘与迭代', description: '胜率、回撤、归因与持仓结构。' },
  calendar: { title: '日历', eyebrow: '复盘与迭代', description: '财报、解禁、宏观事件和复盘计划。' },
  watchlist: { title: '自选池', eyebrow: '工具箱', description: '关注逻辑、目标价与止损价。' },
  tools: { title: '做 T 计算器', eyebrow: '工具箱', description: '费用、净收益与盈亏平衡价。' },
  learning: { title: '学习笔记', eyebrow: '工具箱', description: '经典教材、公开课与自己的 Markdown 笔记。' },
  settings: { title: '设置', eyebrow: '系统', description: '账户、费率、行情和数据备份。' },
}

const NAV: { label: string; items: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: '工作台',
    items: [
      { key: 'dashboard', label: '总览', icon: LayoutDashboard },
      { key: 'positions', label: '持仓', icon: BriefcaseBusiness },
      { key: 'trades', label: '交易流水', icon: ArrowLeftRight },
    ],
  },
  {
    label: '复盘与迭代',
    items: [
      { key: 'reviews', label: '复盘', icon: NotebookPen },
      { key: 'analytics', label: '分析', icon: BarChart3 },
      { key: 'calendar', label: '日历', icon: CalendarDays },
    ],
  },
  {
    label: '工具箱',
    items: [
      { key: 'watchlist', label: '自选池', icon: Star },
      { key: 'tools', label: '做 T 计算器', icon: Calculator },
      { key: 'learning', label: '学习笔记', icon: GraduationCap },
    ],
  },
]

function AccountMenu() {
  const { state, totals, setCurrentAccount } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false))
  const current =
    state.currentAccountId === 'all'
      ? null
      : state.accounts.find((account) => account.id === state.currentAccountId)

  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="account-trigger" onClick={() => setOpen((prev) => !prev)}>
        <span className="account-avatar" style={{ background: current?.color ?? '#c28b3e' }}>
          {(current?.name ?? '全').slice(0, 1)}
        </span>
        <span className="account-trigger-text">
          <small>当前账户</small>
          <strong>{current?.name ?? '全部账户'}</strong>
        </span>
        <ChevronDown size={15} className={clsx('account-chevron', open && 'is-open')} />
      </button>
      {open ? (
        <div className="account-popover">
          <div className="account-popover-head">
            <span>账户视图</span>
            <small>总资产 {formatCurrency(totals.totalAssets)}</small>
          </div>
          <button
            type="button"
            className={clsx('account-option', state.currentAccountId === 'all' && 'is-active')}
            onClick={() => {
              setCurrentAccount('all')
              setOpen(false)
            }}
          >
            <span className="account-dot" style={{ background: '#c28b3e' }}>
              全
            </span>
            <span>
              <strong>全部账户</strong>
              <small>合并查看所有持仓</small>
            </span>
          </button>
          {state.accounts.map((account) => (
            <button
              type="button"
              key={account.id}
              className={clsx('account-option', state.currentAccountId === account.id && 'is-active')}
              onClick={() => {
                setCurrentAccount(account.id)
                setOpen(false)
              }}
            >
              <span className="account-dot" style={{ background: account.color }}>
                {account.name.slice(0, 1)}
              </span>
              <span>
                <strong>{account.name}</strong>
                <small>{account.broker || '未填写券商'} · 现金 {formatMoney(account.cash)}</small>
              </span>
            </button>
          ))}
          <a className="account-manage" href="#/settings" onClick={() => setOpen(false)}>
            <Settings2 size={14} /> 管理账户与资金
          </a>
        </div>
      ) : null}
    </div>
  )
}

export function Layout({
  page,
  onNavigate,
  children,
}: {
  page: PageKey
  onNavigate: (page: PageKey) => void
  children: ReactNode
}) {
  const {
    state,
    quoteBusy,
    quoteError,
    lastQuoteAt,
    refreshQuotes,
    resetAll,
    saveStatus,
    saveError,
    lastSavedAt,
    dataPath,
  } = useStore()
  const { openTrade, toast } = useUi()
  const [collapsed, setCollapsed] = useState(false)
  const meta = PAGE_META[page]
  const refreshRef = useRef(false)
  const saveErrorShown = useRef(false)

  useEffect(() => {
    refreshRef.current = quoteBusy
  }, [quoteBusy])

  useEffect(() => {
    if (saveStatus === 'error' && !saveErrorShown.current) {
      saveErrorShown.current = true
      toast(saveError || '本地数据保存失败', 'error')
    }
    if (saveStatus !== 'error') saveErrorShown.current = false
  }, [saveStatus, saveError, toast])

  const savedLabel =
    saveStatus === 'saving'
      ? '保存中…'
      : saveStatus === 'error'
        ? '保存失败'
        : lastSavedAt
          ? `已存 ${new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
          : '本地文件'

  const handleRefresh = async () => {
    if (refreshRef.current) return
    const result = await refreshQuotes()
    if (result.ok) toast(`行情已更新（${result.count} 只）`, 'success')
    else toast(result.error || '行情刷新失败，可手动修改现价', 'error')
  }

  return (
    <div className={clsx('app-shell', collapsed && 'sidebar-collapsed')}>
      <aside className="sidebar">
        <div className="brand">
          <img src="./logo.svg" alt="Goden Egg" className="brand-logo" />
          <div className="brand-text">
            <strong>Goden Egg</strong>
            <span>会生金蛋的鸡</span>
          </div>
        </div>

        <div className="sidebar-account">
          <AccountMenu />
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    type="button"
                    key={item.key}
                    className={clsx('nav-item', page === item.key && 'is-active')}
                    onClick={() => onNavigate(item.key)}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    {item.key === 'reviews' && state.reviews.length > 0 ? (
                      <small className="nav-count">{state.reviews.length}</small>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={clsx('nav-item', page === 'settings' && 'is-active')}
            onClick={() => onNavigate('settings')}
            title={collapsed ? '设置' : undefined}
          >
            <Settings2 size={18} strokeWidth={1.8} />
            <span>设置</span>
          </button>
          <div className="privacy-note">
            <ShieldCheck size={14} />
            <span>数据只保存在本机</span>
          </div>
          <div className="sidebar-version">Goden Egg v1.0.0</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton label={collapsed ? '展开侧边栏' : '收起侧边栏'} onClick={() => setCollapsed((prev) => !prev)}>
              {collapsed ? <ChevronsRight size={18} /> : <Menu size={18} />}
            </IconButton>
            <div className="breadcrumb">
              <span>{meta.eyebrow}</span>
              <i>/</i>
              <strong>{meta.title}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className={clsx('quote-chip', quoteError && 'has-error')}
              onClick={handleRefresh}
              title={quoteError || '点击刷新实时行情'}
            >
              <RefreshCw size={14} className={quoteBusy ? 'spin' : undefined} />
              <span>
                {state.demoMode
                  ? '示例行情'
                  : quoteBusy
                    ? '更新中'
                    : quoteError
                      ? '行情离线'
                      : lastQuoteAt
                        ? `行情 ${relativeTime(lastQuoteAt)}`
                        : '刷新行情'}
              </span>
            </button>
            <button
              type="button"
              className={clsx('save-chip', `save-${saveStatus}`)}
              onClick={() => onNavigate('settings')}
              title={saveError || (dataPath ? `数据文件：${dataPath}` : '本地数据文件')}
            >
              <HardDrive size={13} />
              <span>{savedLabel}</span>
            </button>
            <span className="topbar-date">{dateWithWeek(todayStr())}</span>
            <Button
              icon={<Sparkles size={16} />}
              onClick={() => openTrade()}
              className="topbar-add"
            >
              记录交易
            </Button>
          </div>
        </header>

        {state.demoMode ? (
          <div className="demo-banner">
            <span>
              <Star size={14} /> 当前展示的是示例数据，可自由修改；不会影响你的真实记录。
            </span>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('清空示例数据并重新开始？建议先导出一份备份。')) {
                  const ok = await resetAll()
                  toast(ok ? '示例数据已清空，请创建你的账户' : '清空失败，请检查本地保存状态', ok ? 'success' : 'error')
                }
              }}
            >
              切换为我的数据
            </button>
          </div>
        ) : null}

        <main className="content">
          <div className="content-inner">{children}</div>
        </main>
      </div>

      <button type="button" className="floating-trade" onClick={() => openTrade()} aria-label="记录交易">
        <Wallet size={19} />
        <span>记一笔</span>
      </button>
    </div>
  )
}
