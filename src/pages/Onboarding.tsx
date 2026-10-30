import { useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Database,
  Egg,
  FolderOpen,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { useUi } from '../components/UiProvider'
import { Button, Field, Input } from '../components/ui'
import { feeBreakdown } from '../lib/calc'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { readTextFile } from '../lib/files'
import { formatMoney, safeNumber } from '../lib/format'

const STEPS = ['账户', '费率', '规则']

export function Onboarding() {
  const { completeOnboarding, loadDemo, importData } = useStore()
  const { toast } = useUi()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('我的账户')
  const [broker, setBroker] = useState('')
  const [capital, setCapital] = useState('100000')
  const [cash, setCash] = useState('100000')
  const [commission, setCommission] = useState('0.025')
  const [minCommission, setMinCommission] = useState('5')
  const [stamp, setStamp] = useState('0.05')
  const [transfer, setTransfer] = useState('0.001')
  const [error, setError] = useState('')
  const importRef = useRef<HTMLInputElement | null>(null)

  const feeSettings = {
    ...DEFAULT_SETTINGS,
    commissionRate: safeNumber(commission) / 100,
    minCommission: safeNumber(minCommission),
    stampTaxRate: safeNumber(stamp) / 100,
    transferFeeRate: safeNumber(transfer) / 100,
  }
  const exampleBuy = feeBreakdown('buy', 10, 1000, feeSettings)
  const exampleSell = feeBreakdown('sell', 10.5, 1000, feeSettings)

  const next = () => {
    if (step === 0) {
      if (!name.trim()) return setError('给账户起个名字吧')
      if (safeNumber(capital) < 0 || safeNumber(cash) < 0) return setError('资金不能为负数')
    }
    if (step === 1) {
      if (safeNumber(commission) < 0 || safeNumber(stamp) < 0 || safeNumber(transfer) < 0) {
        return setError('费率不能为负数')
      }
    }
    setError('')
    setStep((value) => Math.min(2, value + 1))
  }

  const back = () => {
    setError('')
    setStep((value) => Math.max(0, value - 1))
  }

  const start = () => {
    completeOnboarding(
      {
        name: name.trim(),
        broker: broker.trim(),
        initialCapital: safeNumber(capital),
        cash: safeNumber(cash),
      },
      {
        commissionRate: safeNumber(commission) / 100,
        minCommission: safeNumber(minCommission),
        stampTaxRate: safeNumber(stamp) / 100,
        transferFeeRate: safeNumber(transfer) / 100,
      },
    )
    toast('账户已创建，开始记录第一笔交易吧', 'success')
  }

  const startDemo = () => {
    loadDemo()
    toast('示例数据已载入，可以放心探索', 'success')
  }

  const importBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await readTextFile(file))
      importData(parsed)
      toast('备份已导入', 'success')
    } catch (error) {
      toast(error instanceof Error ? `导入失败：${error.message}` : '导入失败：文件格式不正确', 'error')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="onboarding">
      <section className="onboarding-hero">
        <div className="onboarding-brand">
          <img src="./logo.svg" alt="Goden Egg" />
          <div>
            <strong>Goden Egg</strong>
            <span>会生金蛋的鸡</span>
          </div>
        </div>

        <div className="onboarding-copy">
          <div className="onboarding-kicker"><Sparkles size={14} /> 个人股票交易与复盘工作台</div>
          <h1>
            养一只会生
            <br />
            <em>金蛋</em>的鸡。
          </h1>
          <p>
            不预测市场，只帮你看清自己。
            <br />
            记录持仓、交易、情绪和复盘，让每一笔操作都留下痕迹。
          </p>
          <div className="onboarding-quote">
            <Egg size={22} />
            <span>“复利，是世界第八大奇迹。”</span>
          </div>
        </div>

        <div className="onboarding-features">
          <div><span><Wallet size={17} /></span><strong>看清持仓</strong><small>成本、批次、解禁与风险边界</small></div>
          <div><span><BookOpen size={17} /></span><strong>每日复盘</strong><small>市场、操作、情绪，三句话开始</small></div>
          <div><span><BarChart3 size={17} /></span><strong>数据画像</strong><small>胜率、盈亏比、回撤与归因</small></div>
        </div>

        <div className="onboarding-security">
          <ShieldCheck size={15} />
          <span>无需注册 · 数据保存在本机 Node 数据文件</span>
        </div>
      </section>

      <section className="onboarding-panel">
        <div className="onboarding-card wizard-card">
          <div className="wizard-steps">
            {STEPS.map((label, index) => (
              <div key={label} className={index === step ? 'is-active' : index < step ? 'is-done' : ''}>
                <span>{index < step ? <Check size={11} /> : index + 1}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>

          {step === 0 ? (
            <>
              <div className="onboarding-card-head">
                <span className="step-dot">01</span>
                <div>
                  <h2>先给你的账户起个名字</h2>
                  <p>之后可以在设置里添加更多证券账户。</p>
                </div>
              </div>

              <div className="form-grid form-grid-2">
                <Field label="账户名称">
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：主账户" autoFocus />
                </Field>
                <Field label="券商" hint="可选">
                  <Input value={broker} onChange={(event) => setBroker(event.target.value)} placeholder="例如：东方财富" />
                </Field>
              </div>
              <div className="form-grid form-grid-2">
                <Field label="初始投入资金" hint="用于计算累计收益率">
                  <div className="input-affix"><span>¥</span><Input type="number" step="1000" value={capital} onChange={(event) => setCapital(event.target.value)} /></div>
                </Field>
                <Field label="当前可用现金" hint="可以稍后在设置中修改">
                  <div className="input-affix"><span>¥</span><Input type="number" step="1000" value={cash} onChange={(event) => setCash(event.target.value)} /></div>
                </Field>
              </div>

              <div className="onboarding-tip">
                <Wallet size={14} />
                <span>记录买入/卖出时，现金会自动增减；银证转账等出入金请在设置里手动调整。</span>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="onboarding-card-head">
                <span className="step-dot">02</span>
                <div>
                  <h2>设置交易费率</h2>
                  <p>已填入 A 股常见默认值，请按你的券商实际费率修改。</p>
                </div>
              </div>
              <div className="fee-preset">
                <div>
                  <strong>A 股常见费率</strong>
                  <small>佣金 0.025%（最低 5 元）· 印花税 0.05%（仅卖出）· 过户费 0.001%（双边）</small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCommission('0.025')
                    setMinCommission('5')
                    setStamp('0.05')
                    setTransfer('0.001')
                  }}
                >
                  恢复默认
                </button>
              </div>
              <div className="form-grid form-grid-2">
                <Field label="佣金率（%）" hint="不足最低佣金时按最低值收取">
                  <Input type="number" step="0.001" value={commission} onChange={(event) => setCommission(event.target.value)} />
                </Field>
                <Field label="最低佣金（元）">
                  <Input type="number" step="1" value={minCommission} onChange={(event) => setMinCommission(event.target.value)} />
                </Field>
                <Field label="印花税率（%）" hint="仅卖出收取">
                  <Input type="number" step="0.001" value={stamp} onChange={(event) => setStamp(event.target.value)} />
                </Field>
                <Field label="过户费率（%）" hint="买卖双边收取">
                  <Input type="number" step="0.0001" value={transfer} onChange={(event) => setTransfer(event.target.value)} />
                </Field>
              </div>
              <div className="fee-example">
                <span>10 元买入 1000 股：费用约 <strong>¥{formatMoney(exampleBuy.total)}</strong></span>
                <span>10.5 元卖出：费用约 <strong>¥{formatMoney(exampleSell.total)}</strong>（含印花税）</span>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="onboarding-card-head">
                <span className="step-dot">03</span>
                <div>
                  <h2>记住 A 股的几个常识</h2>
                  <p>软件会按这些规则帮你检查交易日期和时间。</p>
                </div>
              </div>
              <div className="market-rules">
                <div><strong>T+1</strong><span>今天买入的股票，下一个交易日才能卖出。</span></div>
                <div><strong>100 股</strong><span>买入通常以 100 股（1 手）为单位，卖出可以不足 100 股。</span></div>
                <div><strong>09:30–11:30 / 13:00–15:00</strong><span>连续竞价时段；周末和法定节假日休市。</span></div>
                <div><strong>±10% / ±20%</strong><span>主板普通股票日涨跌幅 ±10%，ST 为 ±5%，创业板/科创板为 ±20%。</span></div>
                <div><strong>费用</strong><span>佣金、过户费双边收取，印花税仅卖出收取。</span></div>
              </div>
              <div className="onboarding-tip">
                <CheckCircle2 size={14} />
                <span>这些是默认规则，不构成投资建议；费率和休市日可在设置与数据文件中维护。</span>
              </div>
            </>
          ) : null}

          {error ? <div className="form-error">{error}</div> : null}

          <div className="wizard-actions">
            {step > 0 ? (
              <Button variant="secondary" onClick={back} icon={<ArrowLeft size={15} />}>上一步</Button>
            ) : (
              <span />
            )}
            {step < 2 ? (
              <Button onClick={next} icon={<ArrowRight size={16} />}>下一步</Button>
            ) : (
              <Button onClick={start} icon={<ArrowRight size={16} />}>创建账户并开始</Button>
            )}
          </div>

          {step === 0 ? (
            <>
              <div className="onboarding-divider"><span>或者</span></div>
              <div className="onboarding-secondary-actions">
                <Button variant="secondary" onClick={startDemo} icon={<Sparkles size={15} />}>先看看示例</Button>
                <Button variant="ghost" onClick={() => importRef.current?.click()} icon={<FolderOpen size={15} />}>导入备份</Button>
                <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importBackup(event.target.files?.[0])} />
              </div>
            </>
          ) : null}

          <ul className="onboarding-checks">
            <li><CheckCircle2 size={14} /> 不连接券商，不需要账号密码</li>
            <li><CheckCircle2 size={14} /> 数据只写入本机 data/state.json</li>
            <li><CheckCircle2 size={14} /> 支持随时导出 JSON 备份</li>
          </ul>

          <div className="onboarding-foot">
            <Database size={13} />
            <span>首次使用建议先体验示例数据，再清空录入自己的记录。</span>
          </div>
        </div>
      </section>
    </div>
  )
}
