import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowRight,
  Calculator,
  Info,
  RotateCcw,
  Save,
  Trash2,
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
  PageHeader,
} from '../components/ui'
import { calculateT, feeBreakdown } from '../lib/calc'
import { formatCurrency, formatMoney, formatPct, pnlClass, round2, safeNumber } from '../lib/format'
import { relativeTime } from '../lib/dates'

export function Tools() {
  const { state, addTCalculation, deleteTCalculation } = useStore()
  const { toast } = useUi()
  const [buyPrice, setBuyPrice] = useState('10.00')
  const [sellPrice, setSellPrice] = useState('10.50')
  const [quantity, setQuantity] = useState('1000')
  const history = state.tHistory
  const settings = state.settings

  const calc = useMemo(
    () => calculateT(safeNumber(buyPrice), safeNumber(sellPrice), safeNumber(quantity), settings),
    [buyPrice, sellPrice, quantity, settings],
  )
  const buyFees = feeBreakdown('buy', safeNumber(buyPrice), safeNumber(quantity), settings)
  const sellFees = feeBreakdown('sell', safeNumber(sellPrice), safeNumber(quantity), settings)
  const valid = safeNumber(buyPrice) > 0 && safeNumber(sellPrice) > 0 && safeNumber(quantity) > 0

  const save = () => {
    if (!valid) return
    addTCalculation({
      buyPrice: safeNumber(buyPrice),
      sellPrice: safeNumber(sellPrice),
      quantity: safeNumber(quantity),
      netProfit: calc.netProfit,
      netRate: calc.netRate,
    })
    toast('本次做 T 计算已保存到本地文件', 'success')
  }

  const remove = (id: string) => {
    deleteTCalculation(id)
  }

  return (
    <div className="page tools-page">
      <PageHeader
        eyebrow="工具箱 / 做 T 计算器"
        title="先把费用算清楚，再决定要不要做 T"
        description="佣金、过户费和印花税都会吃掉利润。用真实费率算一遍，别凭感觉。"
        actions={<Badge tone="neutral"><Calculator size={12} /> 费率来自设置</Badge>}
      />

      <div className="tools-layout">
        <Card className="tcalc-card">
          <div className="tcalc-head">
            <span className="section-icon"><Calculator size={17} /></span>
            <div>
              <h2>这次 T，能赚多少？</h2>
              <p>默认按 A 股卖出印花税与双边过户费计算。</p>
            </div>
          </div>
          <div className="tcalc-inputs">
            <Field label="买入价">
              <div className="input-affix"><span>¥</span><Input type="number" step="0.01" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} /></div>
            </Field>
            <Field label="卖出价">
              <div className="input-affix"><span>¥</span><Input type="number" step="0.01" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} /></div>
            </Field>
            <Field label="数量（股）">
              <Input type="number" step="100" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
          </div>

          <div className={clsx('tcalc-result', calc.netProfit >= 0 ? 'is-profit' : 'is-loss')}>
            <div>
              <span>预计净收益</span>
              <strong>{calc.netProfit >= 0 ? '+' : ''}¥ {formatMoney(Math.abs(calc.netProfit))}</strong>
              <small className={pnlClass(calc.netRate)}>{formatPct(calc.netRate)} · 已扣除全部费用</small>
            </div>
            <div className="tcalc-result-side">
              <span>盈亏平衡卖出价</span>
              <strong>¥ {calc.breakEvenPrice.toFixed(3)}</strong>
              <small>低于此价，做 T 就是亏手续费</small>
            </div>
          </div>

          <div className="tcalc-detail-grid">
            <div>
              <span>买入金额</span>
              <strong>{formatCurrency(calc.buyAmount)}</strong>
            </div>
            <div>
              <span>卖出金额</span>
              <strong>{formatCurrency(calc.sellAmount)}</strong>
            </div>
            <div>
              <span>毛利润</span>
              <strong className={pnlClass(calc.grossProfit)}>{formatCurrency(calc.grossProfit)}</strong>
            </div>
            <div>
              <span>总费用</span>
              <strong>{formatCurrency(round2(buyFees.total + sellFees.total))}</strong>
            </div>
          </div>

          <div className="fee-breakdown">
            <div className="fee-breakdown-head">
              <span>费用明细</span>
              <span>买入</span>
              <span>卖出</span>
            </div>
            <div><span>佣金</span><span>{formatMoney(buyFees.commission)}</span><span>{formatMoney(sellFees.commission)}</span></div>
            <div><span>过户费</span><span>{formatMoney(buyFees.transfer)}</span><span>{formatMoney(sellFees.transfer)}</span></div>
            <div><span>印花税</span><span>—</span><span>{formatMoney(sellFees.stamp)}</span></div>
            <div className="fee-total"><span>合计</span><span>{formatMoney(buyFees.total)}</span><span>{formatMoney(sellFees.total)}</span></div>
          </div>

          <div className="tcalc-actions">
            <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={() => { setBuyPrice(''); setSellPrice(''); setQuantity('') }}>清空</Button>
            <Button icon={<Save size={15} />} onClick={save} disabled={!valid}>保存这次计算</Button>
          </div>
        </Card>

        <div className="tools-side">
          <Card className="tcalc-tips">
            <div className="insight-head"><Info size={16} /><span>费用速览</span></div>
            <div className="fee-rule-list">
              <div><span>佣金</span><strong>{(settings.commissionRate * 1000).toFixed(3)}‰</strong><small>最低 {settings.minCommission} 元</small></div>
              <div><span>印花税</span><strong>{(settings.stampTaxRate * 100).toFixed(3)}%</strong><small>仅卖出收取</small></div>
              <div><span>过户费</span><strong>{(settings.transferFeeRate * 1000).toFixed(4)}‰</strong><small>买卖双边</small></div>
            </div>
            <a href="#/settings" className="panel-link">调整费率 <ArrowRight size={14} /></a>
          </Card>

          <Card className="tcalc-note-card">
            <div className="insight-head"><TrendingUp size={16} /><span>做 T 之前</span></div>
            <ul>
              <li>先确认底仓和可卖数量，A 股当日买入不能当日卖出。</li>
              <li>把手续费算进去，1% 以下的波动可能不值得做。</li>
              <li>做 T 失败时，是否愿意把仓位接回来？先想好退路。</li>
              <li>频繁做 T 容易把注意力从大逻辑上移开。</li>
            </ul>
          </Card>

          <Card className="tcalc-history-card">
            <div className="aside-head">
              <strong>计算历史</strong>
              <Badge tone="neutral">{history.length}</Badge>
            </div>
            {history.length === 0 ? (
              <EmptyState compact icon={<Calculator size={22} />} title="还没有记录" description="保存一次计算，方便回看费用对收益的影响。" />
            ) : (
              <div className="tcalc-history-list">
                {history.map((item) => (
                  <div className="tcalc-history-row" key={item.id}>
                    <span>
                      <strong>{item.buyPrice.toFixed(2)} → {item.sellPrice.toFixed(2)}</strong>
                      <small>{item.quantity} 股 · {relativeTime(item.createdAt)}</small>
                    </span>
                    <strong className={pnlClass(item.netProfit)}>{item.netProfit >= 0 ? '+' : ''}{formatMoney(item.netProfit)}</strong>
                    <button type="button" onClick={() => remove(item.id)} aria-label="删除记录"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
