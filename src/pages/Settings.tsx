import { useRef, useState } from 'react'
import clsx from 'clsx'
import {
  Archive,
  CalendarDays,
  Check,
  Database,
  Download,
  ExternalLink,
  HardDrive,
  Info,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { useUi } from '../components/UiProvider'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  Toggle,
} from '../components/ui'
import type { Account } from '../types'
import { ACCOUNT_COLORS } from '../lib/constants'
import { downloadText, readTextFile } from '../lib/files'
import { formatCurrency, formatMoney, safeNumber } from '../lib/format'
import { todayStr } from '../lib/dates'

function AccountModal({
  open,
  initial,
  onClose,
}: {
  open: boolean
  initial: Account | null
  onClose: () => void
}) {
  const { addAccount, updateAccount } = useStore()
  const { toast } = useUi()
  const [name, setName] = useState(initial?.name ?? '')
  const [broker, setBroker] = useState(initial?.broker ?? '')
  const [color, setColor] = useState(initial?.color ?? ACCOUNT_COLORS[0])
  const [initialCapital, setInitialCapital] = useState(initial ? String(initial.initialCapital) : '')
  const [cash, setCash] = useState(initial ? String(initial.cash) : '')
  const [error, setError] = useState('')

  const submit = () => {
    if (!name.trim()) return setError('请填写账户名称')
    const payload = {
      name: name.trim(),
      broker: broker.trim(),
      color,
      initialCapital: safeNumber(initialCapital),
      cash: safeNumber(cash),
    }
    if (initial) {
      updateAccount(initial.id, payload)
      toast('账户信息已更新', 'success')
    } else {
      addAccount(payload)
      toast('账户已添加', 'success')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? '编辑账户' : '添加证券账户'}
      subtitle="不同账户的数据会独立计算，也可以切换“全部账户”合并查看。"
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={submit}>{initial ? '保存修改' : '添加账户'}</Button>
        </>
      }
    >
      <div className="form-grid form-grid-2">
        <Field label="账户名称">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：主账户" />
        </Field>
        <Field label="券商" hint="可选">
          <Input value={broker} onChange={(event) => setBroker(event.target.value)} placeholder="例如：东方财富" />
        </Field>
      </div>
      <Field label="账户颜色">
        <div className="color-swatches">
          {ACCOUNT_COLORS.map((item) => (
            <button type="button" key={item} className={clsx('color-swatch', color === item && 'is-active')} style={{ background: item }} onClick={() => setColor(item)} aria-label={`选择颜色 ${item}`}>
              {color === item ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
      </Field>
      <div className="form-grid form-grid-2">
        <Field label="初始投入资金" hint="用于计算累计收益率">
          <div className="input-affix"><span>¥</span><Input type="number" step="100" value={initialCapital} onChange={(event) => setInitialCapital(event.target.value)} placeholder="0" /></div>
        </Field>
        <Field label="当前可用现金">
          <div className="input-affix"><span>¥</span><Input type="number" step="100" value={cash} onChange={(event) => setCash(event.target.value)} placeholder="0" /></div>
        </Field>
      </div>
      <p className="form-note"><Info size={13} /> 记录买卖时现金会自动增减；银证转账等出入金请在这里手动调整余额。</p>
      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  )
}

export function Settings() {
  const {
    state,
    updateSettings,
    deleteAccount,
    resetAll,
    loadDemo,
    exportBackup,
    importData,
    refreshQuotes,
    quoteBusy,
    saveStatus,
    saveError,
    lastSavedAt,
    dataPath,
  } = useStore()
  const { toast } = useUi()
  const [accountModal, setAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ data: unknown; name: string } | null>(null)
  const importRef = useRef<HTMLInputElement | null>(null)

  const [commission, setCommission] = useState((state.settings.commissionRate * 100).toString())
  const [minCommission, setMinCommission] = useState(String(state.settings.minCommission))
  const [stamp, setStamp] = useState((state.settings.stampTaxRate * 100).toString())
  const [transfer, setTransfer] = useState((state.settings.transferFeeRate * 100).toString())
  const [ratesSaved, setRatesSaved] = useState(false)

  const [aiEndpoint, setAiEndpoint] = useState(state.settings.ai.endpoint)
  const [aiKey, setAiKey] = useState(state.settings.ai.apiKey)
  const [aiModel, setAiModel] = useState(state.settings.ai.model)
  const [aiSaved, setAiSaved] = useState(false)

  const saveRates = () => {
    updateSettings({
      commissionRate: safeNumber(commission) / 100,
      minCommission: safeNumber(minCommission),
      stampTaxRate: safeNumber(stamp) / 100,
      transferFeeRate: safeNumber(transfer) / 100,
    })
    setRatesSaved(true)
    window.setTimeout(() => setRatesSaved(false), 1800)
    toast('交易费率已更新，新记录将按新费率计算', 'success')
  }

  const saveAi = () => {
    updateSettings({
      ai: {
        endpoint: aiEndpoint.trim() || 'https://api.openai.com/v1',
        apiKey: aiKey.trim(),
        model: aiModel.trim() || 'gpt-4o-mini',
      },
    })
    setAiSaved(true)
    window.setTimeout(() => setAiSaved(false), 1800)
    toast('AI 设置已保存', 'success')
  }

  const exportData = () => {
    downloadText(`GodenEgg-备份-${todayStr()}.json`, exportBackup())
    toast('数据备份已下载', 'success')
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await readTextFile(file)
      const parsed = JSON.parse(text)
      const summary = parsed?.state ?? parsed
      const trades = Array.isArray(summary?.trades) ? summary.trades.length : 0
      const reviews = Array.isArray(summary?.reviews) ? summary.reviews.length : 0
      setPendingImport({ data: parsed, name: `${file.name}（${trades} 笔交易，${reviews} 篇复盘）` })
    } catch (error) {
      toast(error instanceof Error ? `导入失败：${error.message}` : '导入失败：文件格式不正确', 'error')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const handleRefresh = async () => {
    const result = await refreshQuotes()
    toast(result.ok ? `行情已更新（${result.count} 只）` : result.error || '行情刷新失败', result.ok ? 'success' : 'error')
  }

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="系统 / 设置"
        title="把规则定好，让执行变简单"
        description="账户、费率、行情和笔记都通过本地 Node 服务写入 data/state.json。"
        actions={<Badge tone="green"><ShieldCheck size={12} /> 本地优先</Badge>}
      />

      <div className="settings-grid">
        <Card className="settings-section accounts-section">
          <div className="settings-head">
            <div className="settings-title">
              <span className="settings-icon"><Wallet size={17} /></span>
              <div><h2>账户与资金</h2><p>多账户独立核算，也可以合并查看。</p></div>
            </div>
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => { setEditingAccount(null); setAccountModal(true) }}>添加账户</Button>
          </div>
          <div className="account-settings-list">
            {state.accounts.map((account) => (
              <div className="account-settings-row" key={account.id}>
                <span className="account-dot large" style={{ background: account.color }}>{account.name.slice(0, 1)}</span>
                <div className="account-settings-name">
                  <strong>{account.name}</strong>
                  <small>{account.broker || '未填写券商'} · 初始投入 {formatMoney(account.initialCapital)}</small>
                </div>
                <div className="account-settings-money">
                  <span>可用现金</span>
                  <strong>{formatCurrency(account.cash)}</strong>
                </div>
                <div className="row-actions">
                  <button type="button" className="icon-btn tiny" onClick={() => { setEditingAccount(account); setAccountModal(true) }} aria-label="编辑账户"><Pencil size={14} /></button>
                  <button type="button" className="icon-btn tiny danger" disabled={state.accounts.length <= 1} onClick={() => setDeletingAccount(account)} aria-label="删除账户"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="settings-section rate-section">
          <div className="settings-head">
            <div className="settings-title">
              <span className="settings-icon"><Archive size={17} /></span>
              <div><h2>交易费率</h2><p>用于自动计算每笔交易费用和做 T 成本。</p></div>
            </div>
            {ratesSaved ? <Badge tone="green"><Check size={12} /> 已保存</Badge> : null}
          </div>
          <div className="settings-form-grid">
            <Field label="佣金率（%）" hint="常见为 0.025%，即万分之 2.5">
              <Input type="number" step="0.001" value={commission} onChange={(event) => setCommission(event.target.value)} />
            </Field>
            <Field label="最低佣金（元）" hint="不足 5 元按 5 元收取">
              <Input type="number" step="1" value={minCommission} onChange={(event) => setMinCommission(event.target.value)} />
            </Field>
            <Field label="印花税率（%）" hint="仅卖出收取，当前为 0.05%">
              <Input type="number" step="0.001" value={stamp} onChange={(event) => setStamp(event.target.value)} />
            </Field>
            <Field label="过户费率（%）" hint="买卖双边收取，当前为 0.001%">
              <Input type="number" step="0.0001" value={transfer} onChange={(event) => setTransfer(event.target.value)} />
            </Field>
          </div>
          <div className="settings-actions">
            <Button size="sm" onClick={saveRates}>保存费率</Button>
          </div>
        </Card>

        <Card className="settings-section quote-section">
          <div className="settings-head">
            <div className="settings-title">
              <span className="settings-icon"><RefreshCw size={17} /></span>
              <div><h2>行情数据</h2><p>行情来自腾讯财经，失败时可手动更新现价。</p></div>
            </div>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={handleRefresh} loading={quoteBusy}>刷新</Button>
          </div>
          <div className="settings-toggle-row">
            <div>
              <strong>启动时自动刷新</strong>
              <small>打开应用后拉取一次持仓与自选股行情</small>
            </div>
            <Toggle checked={state.settings.autoRefreshQuotes} onChange={(checked) => updateSettings({ autoRefreshQuotes: checked })} />
          </div>
          <div className="settings-note">
            <Info size={14} />
            <span>行情接口可能受网络或休市影响。休市时显示的是最近一次成功获取的价格。</span>
          </div>
          <div className="settings-note">
            <CalendarDays size={14} />
            <span>交易日历已内置 2025–2026 年官方休市日与 2027 年元旦；后续安排可在 src/data/market-holidays.json 补充。</span>
          </div>
        </Card>

        <Card className="settings-section ai-section">
          <div className="settings-head">
            <div className="settings-title">
              <span className="settings-icon"><Sparkles size={17} /></span>
              <div><h2>AI 复盘助手</h2><p>可选。接入 OpenAI 兼容接口，让 AI 帮你追问交易逻辑。</p></div>
            </div>
            {aiSaved ? <Badge tone="green"><Check size={12} /> 已保存</Badge> : null}
          </div>
          <div className="settings-form-grid">
            <Field label="API 地址">
              <Input value={aiEndpoint} onChange={(event) => setAiEndpoint(event.target.value)} placeholder="https://api.openai.com/v1" />
            </Field>
            <Field label="模型">
              <Input value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder="gpt-4o-mini" />
            </Field>
          </div>
          <Field label="API Key" hint="保存在本机 data/state.json；导出备份时自动移除">
            <div className="input-affix"><KeyRound size={14} /><Input type="password" value={aiKey} onChange={(event) => setAiKey(event.target.value)} placeholder="sk-..." autoComplete="off" /></div>
          </Field>
          <div className="settings-actions">
            <Button size="sm" onClick={saveAi}>保存 AI 设置</Button>
          </div>
          <div className="settings-note">
            <ShieldCheck size={14} />
            <span>使用 AI 时，复盘内容会发送给你配置的服务商。API Key 存在本机数据文件中，但导出备份时会自动移除。</span>
          </div>
        </Card>

        <Card className="settings-section data-section">
          <div className="settings-head">
            <div className="settings-title">
              <span className="settings-icon"><Database size={17} /></span>
              <div><h2>数据管理</h2><p>定期导出 JSON 备份，避免误删本地文件或迁移时丢失。</p></div>
            </div>
          </div>
          <div className="storage-status">
            <span className="storage-status-icon"><HardDrive size={16} /></span>
            <div className="storage-status-main">
              <strong>Node 本地文件存储</strong>
              <code title={dataPath || 'data/state.json'}>{dataPath || 'data/state.json'}</code>
              <small>
                {saveStatus === 'saving'
                  ? '正在写入本地文件…'
                  : saveStatus === 'error'
                    ? `保存失败：${saveError}`
                    : lastSavedAt
                      ? `最近保存 ${new Date(lastSavedAt).toLocaleString('zh-CN')}`
                      : '等待第一次保存'}
              </small>
            </div>
            <button
              type="button"
              className="storage-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(dataPath || 'data/state.json')
                  toast('数据文件路径已复制', 'success')
                } catch {
                  toast('复制失败，请手动查看 data/state.json', 'error')
                }
              }}
            >
              复制路径
            </button>
          </div>
          <div className="data-action-grid">
            <button type="button" className="data-action" onClick={exportData}>
              <Download size={19} />
              <strong>导出完整备份</strong>
              <small>账户、交易、复盘、快照与设置</small>
            </button>
            <button type="button" className="data-action" onClick={() => importRef.current?.click()}>
              <Upload size={19} />
              <strong>导入备份</strong>
              <small>从 Goden Egg 的 JSON 备份恢复</small>
            </button>
            <button type="button" className="data-action" onClick={() => setDemoOpen(true)}>
              <Sparkles size={19} />
              <strong>载入示例数据</strong>
              <small>体验完整功能，会覆盖当前数据</small>
            </button>
            <button type="button" className="data-action danger" onClick={() => setResetOpen(true)}>
              <Trash2 size={19} />
              <strong>清空并重新开始</strong>
              <small>删除本机全部记录，不可恢复</small>
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
          />
          <div className="settings-note">
            <Info size={14} />
            <span>数据保存在本机 data/state.json，并每天自动保留一份历史备份。重装系统或迁移电脑前，请先导出 JSON 备份。</span>
          </div>
        </Card>

        <Card className="settings-section about-section">
          <div className="about-brand">
            <img src="./logo.svg" alt="Goden Egg" />
            <div>
              <strong>Goden Egg</strong>
              <span>会生金蛋的鸡 · v1.0.0</span>
            </div>
          </div>
          <p>一个本地优先的个人股票交易与复盘工作台。数据由本机 Node 服务写入 JSON 文件，不预测市场，只帮你看清自己。</p>
          <div className="about-meta">
            <span><ShieldCheck size={13} /> 无需注册</span>
            <span><Database size={13} /> 本机存储</span>
            <span><ExternalLink size={13} /> Windows / 浏览器</span>
          </div>
        </Card>
      </div>

      <AccountModal
        key={`${editingAccount?.id ?? 'new'}-${accountModal}`}
        open={accountModal}
        initial={editingAccount}
        onClose={() => { setAccountModal(false); setEditingAccount(null) }}
      />

      <ConfirmDialog
        open={Boolean(deletingAccount)}
        title="删除这个账户？"
        description={deletingAccount ? `将删除「${deletingAccount.name}」及其全部交易记录和持仓备注。此操作不可恢复。` : ''}
        confirmText="删除账户"
        onClose={() => setDeletingAccount(null)}
        onConfirm={() => {
          if (deletingAccount) {
            deleteAccount(deletingAccount.id)
            toast('账户已删除', 'success')
          }
          setDeletingAccount(null)
        }}
      />

      <ConfirmDialog
        open={demoOpen}
        title="载入示例数据？"
        description="当前账户、交易、复盘和设置会被示例数据替换。建议先导出一份备份。"
        confirmText="载入示例"
        tone="primary"
        onClose={() => setDemoOpen(false)}
        onConfirm={() => {
          loadDemo()
          setDemoOpen(false)
          toast('示例数据已载入', 'success')
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        title="清空全部数据？"
        description="所有账户、交易、复盘、快照和设置都会被删除，且无法恢复。请确认已经导出备份。"
        confirmText="确认清空"
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          const ok = await resetAll()
          setResetOpen(false)
          toast(ok ? '本地数据和备份已清空' : '清空失败，请查看保存状态', ok ? 'success' : 'error')
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="导入这份备份？"
        description={pendingImport ? `${pendingImport.name}。导入后会替换当前全部数据。` : ''}
        confirmText="确认导入"
        tone="primary"
        onClose={() => setPendingImport(null)}
        onConfirm={() => {
          if (pendingImport) {
            try {
              importData(pendingImport.data)
              toast('备份已导入', 'success')
            } catch (error) {
              toast(error instanceof Error ? `导入失败：${error.message}` : '导入失败', 'error')
            }
          }
          setPendingImport(null)
        }}
      />
    </div>
  )
}
