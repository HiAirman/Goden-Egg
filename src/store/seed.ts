import type { Account, AppState, DailyReview, Note, Settings, WeeklyReview } from '../types'
import { addDays, format } from 'date-fns'
import { ACCOUNT_COLORS, DEFAULT_SETTINGS } from '../lib/constants'
import { calcFees, buildPositions, buildTotals } from '../lib/calc'
import { mondayOf, todayStr } from '../lib/dates'
import { uid } from '../lib/id'

function day(offset: number): string {
  return format(addDays(new Date(), offset), 'yyyy-MM-dd')
}

function stamp(date: string, time = '10:00'): number {
  return new Date(`${date}T${time}:00`).getTime()
}

export function createEmptyState(): AppState {
  const account: Account = {
    id: uid('acc'),
    name: '我的账户',
    broker: '',
    color: ACCOUNT_COLORS[0],
    initialCapital: 0,
    cash: 0,
    createdAt: Date.now(),
  }
  return {
    version: 1,
    onboarded: false,
    demoMode: false,
    currentAccountId: account.id,
    accounts: [account],
    trades: [],
    positionMeta: {},
    watchlist: [],
    reviews: [],
    weeklyReviews: [],
    notes: [],
    tHistory: [],
    events: [],
    snapshots: [],
    quotes: {},
    settings: structuredClone(DEFAULT_SETTINGS) as Settings,
  }
}

export function createDemoState(): AppState {
  const account: Account = {
    id: uid('acc'),
    name: '主账户',
    broker: '东方财富',
    color: ACCOUNT_COLORS[0],
    initialCapital: 800000,
    cash: 185052,
    createdAt: stamp(day(-300), '09:00'),
  }
  const settings = structuredClone(DEFAULT_SETTINGS) as Settings
  const trades: AppState['trades'] = []

  const addTrade = (input: {
    symbol: string
    name: string
    side: 'buy' | 'sell'
    price: number
    quantity: number
    date: string
    time: string
    reasonTags: string[]
    emotion: string
    note?: string
    unlockDate?: string
    batchLabel?: string
  }) => {
    const fee = calcFees(input.side, input.price, input.quantity, settings)
    trades.push({
      id: uid('trd'),
      accountId: account.id,
      symbol: input.symbol,
      name: input.name,
      side: input.side,
      price: input.price,
      quantity: input.quantity,
      fee,
      date: input.date,
      time: input.time,
      reasonTags: input.reasonTags,
      emotion: input.emotion,
      note: input.note ?? '',
      unlockDate: input.unlockDate,
      batchLabel: input.batchLabel,
      createdAt: stamp(input.date, input.time),
    })
  }

  addTrade({
    symbol: '600519',
    name: '贵州茅台',
    side: 'buy',
    price: 1320,
    quantity: 100,
    date: day(-160),
    time: '10:12',
    reasonTags: ['估值修复', '分批建仓'],
    emotion: '冷静',
    note: '估值回到近五年低位，先建观察仓。',
  })
  addTrade({
    symbol: '600519',
    name: '贵州茅台',
    side: 'buy',
    price: 1365,
    quantity: 100,
    date: day(-40),
    time: '14:23',
    reasonTags: ['回踩支撑', '计划内'],
    emotion: '自信',
    note: '年线附近获得支撑，按计划加仓。',
  })
  addTrade({
    symbol: '600519',
    name: '贵州茅台',
    side: 'sell',
    price: 1410,
    quantity: 100,
    date: day(-4),
    time: '10:05',
    reasonTags: ['止盈', '计划内'],
    emotion: '冷静',
    note: '达到第一目标位，先兑现一半。',
  })

  addTrade({
    symbol: '300750',
    name: '宁德时代',
    side: 'buy',
    price: 238.4,
    quantity: 500,
    date: day(-220),
    time: '09:48',
    reasonTags: ['趋势跟随', '分批建仓'],
    emotion: '冷静',
  })
  addTrade({
    symbol: '300750',
    name: '宁德时代',
    side: 'buy',
    price: 226.5,
    quantity: 300,
    date: day(-90),
    time: '13:36',
    reasonTags: ['补仓摊薄'],
    emotion: '犹豫',
    note: '回调幅度超预期，补仓但控制总仓位。',
  })
  addTrade({
    symbol: '300750',
    name: '宁德时代',
    side: 'sell',
    price: 252.8,
    quantity: 200,
    date: day(-15),
    time: '10:31',
    reasonTags: ['移动止盈'],
    emotion: '冷静',
    note: '反弹到前高附近，减掉补仓部分。',
  })

  addTrade({
    symbol: '300308',
    name: '中际旭创',
    side: 'buy',
    price: 156.8,
    quantity: 500,
    date: day(-100),
    time: '11:02',
    reasonTags: ['业绩超预期', '突破买入'],
    emotion: '自信',
    note: 'AI 算力订单超预期，突破平台买入。',
    unlockDate: day(21),
    batchLabel: '员工持股第一批',
  })
  addTrade({
    symbol: '300308',
    name: '中际旭创',
    side: 'buy',
    price: 172.4,
    quantity: 300,
    date: day(-35),
    time: '14:10',
    reasonTags: ['回踩支撑'],
    emotion: '冷静',
  })
  addTrade({
    symbol: '300308',
    name: '中际旭创',
    side: 'sell',
    price: 188.6,
    quantity: 300,
    date: day(-9),
    time: '09:55',
    reasonTags: ['止盈'],
    emotion: '贪婪',
    note: '卖早了一半，剩下继续持有。',
  })

  addTrade({
    symbol: '600036',
    name: '招商银行',
    side: 'buy',
    price: 41.2,
    quantity: 1200,
    date: day(-260),
    time: '10:40',
    reasonTags: ['估值修复', '计划内'],
    emotion: '冷静',
    note: '高股息底仓，长期持有。',
  })

  addTrade({
    symbol: '601318',
    name: '中国平安',
    side: 'buy',
    price: 58.4,
    quantity: 800,
    date: day(-180),
    time: '09:36',
    reasonTags: ['估值修复'],
    emotion: '犹豫',
  })
  addTrade({
    symbol: '601318',
    name: '中国平安',
    side: 'sell',
    price: 55.6,
    quantity: 800,
    date: day(-25),
    time: '14:42',
    reasonTags: ['纪律止损'],
    emotion: '后悔',
    note: '跌破止损位，执行纪律离场。',
  })

  addTrade({
    symbol: '002594',
    name: '比亚迪',
    side: 'buy',
    price: 322.6,
    quantity: 300,
    date: day(-30),
    time: '10:18',
    reasonTags: ['消息驱动'],
    emotion: '急躁',
    note: '看到销量新闻追高，买点不够耐心。',
  })

  addTrade({
    symbol: '000858',
    name: '五粮液',
    side: 'buy',
    price: 128.6,
    quantity: 400,
    date: day(-70),
    time: '13:12',
    reasonTags: ['估值修复', '分批建仓'],
    emotion: '冷静',
  })

  addTrade({
    symbol: '688981',
    name: '中芯国际',
    side: 'buy',
    price: 96.2,
    quantity: 800,
    date: day(-55),
    time: '10:55',
    reasonTags: ['趋势跟随', '计划内'],
    emotion: '自信',
    note: '国产替代主线，突破年线后建仓。',
  })

  const positionMeta: AppState['positionMeta'] = {
    [`${account.id}::600519`]: {
      sector: '白酒',
      thesis: '高端白酒品牌壁垒强，估值处于历史低位，等待消费复苏。',
      stopLoss: 1260,
      targetPrice: 1580,
      tags: ['核心仓', '低估值'],
      updatedAt: Date.now(),
    },
    [`${account.id}::300750`]: {
      sector: '新能源',
      thesis: '全球动力电池龙头，储能第二曲线，关注产能利用率。',
      stopLoss: 215,
      targetPrice: 285,
      tags: ['成长', '龙头'],
      updatedAt: Date.now(),
    },
    [`${account.id}::300308`]: {
      sector: '人工智能',
      thesis: 'AI 光模块景气度高，订单能见度到明年，注意交易拥挤度。',
      stopLoss: 158,
      targetPrice: 210,
      tags: ['主线', '高波动'],
      updatedAt: Date.now(),
    },
    [`${account.id}::600036`]: {
      sector: '银行',
      thesis: '零售银行龙头，资产质量稳健，作为高股息底仓。',
      stopLoss: 38,
      targetPrice: 48,
      tags: ['底仓', '高股息'],
      updatedAt: Date.now(),
    },
    [`${account.id}::002594`]: {
      sector: '汽车',
      thesis: '新能源车龙头，但当前买点偏高，等待回调或业绩验证。',
      stopLoss: 295,
      targetPrice: 360,
      tags: ['观察'],
      updatedAt: Date.now(),
    },
    [`${account.id}::000858`]: {
      sector: '白酒',
      thesis: '浓香龙头，渠道库存改善，弹性标的。',
      stopLoss: 118,
      targetPrice: 150,
      tags: ['弹性'],
      updatedAt: Date.now(),
    },
    [`${account.id}::688981`]: {
      sector: '半导体',
      thesis: '先进制程扩产与国产替代，政策催化密集。',
      stopLoss: 88,
      targetPrice: 125,
      tags: ['科技', '政策'],
      updatedAt: Date.now(),
    },
  }

  const quotes: AppState['quotes'] = {
    '600519': { symbol: '600519', name: '贵州茅台', price: 1392.05, prevClose: 1354, open: 1363, high: 1393.37, low: 1352.98, changePct: 2.81, updatedAt: Date.now() - 1000 * 60 * 12 },
    '300750': { symbol: '300750', name: '宁德时代', price: 241.6, prevClose: 238.2, open: 239.1, high: 244.3, low: 237.5, changePct: 1.43, updatedAt: Date.now() - 1000 * 60 * 12 },
    '300308': { symbol: '300308', name: '中际旭创', price: 179.8, prevClose: 182.5, open: 182.2, high: 183.9, low: 178.6, changePct: -1.48, updatedAt: Date.now() - 1000 * 60 * 12 },
    '600036': { symbol: '600036', name: '招商银行', price: 43.92, prevClose: 43.55, open: 43.6, high: 44.08, low: 43.42, changePct: 0.85, updatedAt: Date.now() - 1000 * 60 * 12 },
    '601318': { symbol: '601318', name: '中国平安', price: 55.4, prevClose: 56.1, open: 56.0, high: 56.2, low: 55.2, changePct: -1.25, updatedAt: Date.now() - 1000 * 60 * 12 },
    '002594': { symbol: '002594', name: '比亚迪', price: 310.2, prevClose: 315.6, open: 314.8, high: 316.0, low: 309.4, changePct: -1.71, updatedAt: Date.now() - 1000 * 60 * 12 },
    '000858': { symbol: '000858', name: '五粮液', price: 133.4, prevClose: 131.8, open: 132.0, high: 134.1, low: 131.5, changePct: 1.21, updatedAt: Date.now() - 1000 * 60 * 12 },
    '688981': { symbol: '688981', name: '中芯国际', price: 108.4, prevClose: 105.6, open: 106.2, high: 109.8, low: 105.1, changePct: 2.65, updatedAt: Date.now() - 1000 * 60 * 12 },
    '688256': { symbol: '688256', name: '寒武纪', price: 152.8, prevClose: 150.2, open: 151.4, high: 155.6, low: 149.8, changePct: 1.73, updatedAt: Date.now() - 1000 * 60 * 12 },
    '300059': { symbol: '300059', name: '东方财富', price: 25.84, prevClose: 25.2, open: 25.3, high: 26.1, low: 25.0, changePct: 2.54, updatedAt: Date.now() - 1000 * 60 * 12 },
    '600276': { symbol: '600276', name: '恒瑞医药', price: 55.4, prevClose: 54.8, open: 54.9, high: 55.9, low: 54.5, changePct: 1.09, updatedAt: Date.now() - 1000 * 60 * 12 },
    'sh000001': { symbol: 'sh000001', name: '上证指数', price: 4021.6, prevClose: 3998.2, open: 4001.2, high: 4030.4, low: 3995.1, changePct: 0.59, updatedAt: Date.now() - 1000 * 60 * 12 },
    'sz399001': { symbol: 'sz399001', name: '深证成指', price: 13864.2, prevClose: 13790.5, open: 13802.1, high: 13910.6, low: 13771.4, changePct: 0.53, updatedAt: Date.now() - 1000 * 60 * 12 },
    'sz399006': { symbol: 'sz399006', name: '创业板指', price: 3218.7, prevClose: 3195.4, open: 3201.2, high: 3230.8, low: 3188.9, changePct: 0.73, updatedAt: Date.now() - 1000 * 60 * 12 },
  }

  const reviews: DailyReview[] = []
  const reviewTexts = [
    {
      date: day(-3),
      mood: 'neutral' as const,
      market: '指数分化，AI 主线高位震荡，银行护盘。量能没有明显放大，继续控制仓位。',
      worked: '按计划在茅台冲高时兑现了一半仓位，没有因为继续上涨而改变计划。',
      failed: '盘中看到中际旭创快速拉升，差点追高，虽然忍住了，但情绪被分时图带着走。',
      lessons: '计划内的交易才值得做。盘中临时起意的交易，大多数时候是噪音。',
      emotion: '下午略有些急躁，明天把看盘时间固定在 9:45、10:30、14:30 三个时点。',
      plan: '① 关注中际旭创 175 元附近支撑；② 茅台剩余仓位持有，跌破 1340 减仓；③ 不新增题材股。',
      score: 4,
      tags: ['执行到位', '需要耐心'],
    },
    {
      date: day(-1),
      mood: 'bullish' as const,
      market: '两市放量上涨，AI 算力、半导体领涨，情绪修复明显。',
      worked: '持仓中的中芯国际放量突破，没有提前下车。',
      failed: '早盘把五粮液的挂单撤了，错过低吸位置。',
      lessons: '挂单前想清楚逻辑，不要被开盘十分钟的波动影响。',
      emotion: '整体平稳，看到别人赚钱时有轻微 FOMO。',
      plan: '不追高，等回踩；关注半导体持续性。',
      score: 3,
      tags: ['错过机会', '节奏良好'],
    },
    {
      date: day(-2),
      mood: 'bearish' as const,
      market: '指数缩量回调，高位股补跌，市场情绪偏谨慎。',
      worked: '没有在下跌中乱补仓，现金比例保持住了。',
      failed: '比亚迪的止损位设得太随意，盘中没有执行。',
      lessons: '止损是买入前就要定好的，不是盘中再想。',
      emotion: '有些焦虑，但还能按计划执行。',
      plan: '检查所有持仓的止损位，跌破就减。',
      score: 3,
      tags: ['仓位过重', '需要耐心'],
    },
    {
      date: day(-5),
      mood: 'neutral' as const,
      market: '指数窄幅震荡，成交额萎缩，板块轮动加快。',
      worked: '全天没有交易，管住了手。',
      failed: '复盘时发现最近三笔卖出都偏早，止盈规则需要细化。',
      lessons: '止盈可以分批，但要有明确的触发条件，不能凭感觉。',
      emotion: '平静。',
      plan: '把止盈规则写成清单，明天开始执行。',
      score: 5,
      tags: ['执行到位', '研究不足'],
    },
    {
      date: day(-8),
      mood: 'bullish' as const,
      market: '券商、保险带动指数上行，成交量重回万亿。',
      worked: '招商银行底仓拿住了，没有因为涨得慢而换股。',
      failed: '中国平安止损后反弹，心态有点失衡。',
      lessons: '止损后不回头看，按新的事实做决策。',
      emotion: '有一点后悔，但接受。',
      plan: '专注现有持仓，不因为一次止损否定体系。',
      score: 4,
      tags: ['止损及时'],
    },
  ]
  for (const item of reviewTexts) {
    reviews.push({
      id: `review_${item.date}`,
      date: item.date,
      mood: item.mood,
      indices: [],
      marketNote: item.market,
      whatWorked: item.worked,
      whatFailed: item.failed,
      lessons: item.lessons,
      emotionalState: item.emotion,
      nextPlan: item.plan,
      disciplineScore: item.score,
      tags: item.tags,
      createdAt: stamp(item.date, '20:30'),
      updatedAt: stamp(item.date, '21:10'),
    })
  }

  const weekStart = mondayOf(todayStr())
  const weeklyReviews: WeeklyReview[] = [
    {
      id: `weekly_${weekStart}`,
      weekStart,
      summary: '本周整体节奏尚可，仓位保持在七成左右。茅台按计划止盈，AI 主线继续贡献浮盈，消费底仓拖累不大。',
      marketReview: '指数震荡上行，量能温和放大。AI 算力、半导体轮动，银行等高股息板块护盘。',
      mistakes: '周一盘中有一次冲动追高，虽然及时撤单，但说明看盘时仍容易被分时图影响。',
      nextWeekPlan: '控制新增仓位，优先处理已有持仓。给每只股票设定明确的加仓/减仓价位，不临时起意。',
      disciplineScore: 4,
      tags: ['执行到位', '需要耐心'],
      createdAt: stamp(day(-1), '21:00'),
      updatedAt: stamp(day(-1), '21:00'),
    },
  ]

  const notes: Note[] = [
    {
      id: uid('note'),
      title: '我的交易检查清单',
      content: [
        '# 买入前检查清单',
        '',
        '- [ ] 这笔交易在计划内吗？',
        '- [ ] 买入逻辑能否用一句话说清楚？',
        '- [ ] 止损位在哪里？跌破后我愿意执行吗？',
        '- [ ] 仓位是否超过了单只股票上限？',
        '- [ ] 如果明天跌 5%，我会加仓、持有还是卖出？',
        '',
        '## 卖出前检查',
        '',
        '1. 逻辑变了吗？',
        '2. 价格到了目标位吗？',
        '3. 还是只是情绪驱动？',
        '',
        '> 先写规则，再做交易。',
      ].join('\n'),
      tags: ['交易系统', '检查清单'],
      pinned: true,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
    },
    {
      id: uid('note'),
      title: '《投资学》读书笔记：风险与收益',
      content: [
        '# 风险与收益',
        '',
        '预期收益不是承诺，波动率也不是风险的全部。',
        '',
        '- **系统性风险**：无法通过分散化消除。',
        '- **非系统性风险**：可以通过组合分散降低。',
        '- 夏普比率衡量每承担一单位总风险获得的超额收益。',
        '',
        '## 对我的启发',
        '',
        '不要只看收益率，还要看为了这个收益承担了多少回撤。',
      ].join('\n'),
      tags: ['投资学', '读书笔记'],
      pinned: false,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    },
  ]

  const events: AppState['events'] = [
    { id: uid('evt'), date: day(2), title: '美联储议息会议', type: 'macro', note: '关注点阵图与鲍威尔发言', createdAt: Date.now() },
    { id: uid('evt'), date: day(4), title: '中际旭创 三季报', type: 'earnings', symbol: '300308', note: '关注光模块出货与毛利率', createdAt: Date.now() },
    { id: uid('evt'), date: day(7), title: '宁德时代 储能发布会', type: 'custom', symbol: '300750', note: '关注新品与订单指引', createdAt: Date.now() },
    { id: uid('evt'), date: day(11), title: '月度复盘', type: 'review', note: '统计本月交易、胜率与最大回撤', createdAt: Date.now() },
  ]

  const watchlist: AppState['watchlist'] = [
    { id: uid('watch'), symbol: '688256', name: '寒武纪', targetPrice: 160, stopLoss: 118, thesis: '国产 AI 芯片龙头，等待回调后的第二买点。', tags: ['AI', '高波动'], addedAt: Date.now() - 1000 * 60 * 60 * 24 * 5 },
    { id: uid('watch'), symbol: '300059', name: '东方财富', targetPrice: 28, stopLoss: 21, thesis: '市场成交额放大时的弹性品种，观察券商板块持续性。', tags: ['券商', '弹性'], addedAt: Date.now() - 1000 * 60 * 60 * 24 * 8 },
    { id: uid('watch'), symbol: '600276', name: '恒瑞医药', targetPrice: 62, stopLoss: 48, thesis: '创新药出海逻辑，等待业绩验证。', tags: ['医药'], addedAt: Date.now() - 1000 * 60 * 60 * 24 * 12 },
    { id: uid('watch'), symbol: '688981', name: '中芯国际', targetPrice: 125, stopLoss: 88, thesis: '已持仓，跟踪先进制程扩产进度。', tags: ['半导体'], addedAt: Date.now() - 1000 * 60 * 60 * 24 * 20 },
  ]

  const state: AppState = {
    version: 1,
    onboarded: true,
    demoMode: true,
    currentAccountId: account.id,
    accounts: [account],
    trades,
    positionMeta,
    watchlist,
    reviews,
    weeklyReviews,
    notes,
    tHistory: [
      {
        id: uid('tcalc'),
        buyPrice: 1360,
        sellPrice: 1392,
        quantity: 100,
        netProfit: 2865.4,
        netRate: 2.11,
        createdAt: stamp(day(-7), '10:20'),
      },
    ],
    events,
    snapshots: [],
    quotes,
    settings,
  }

  const positions = buildPositions(state, account.id)
  const totals = buildTotals(state, positions)
  const snapshotDays = 120
  const dates: string[] = []
  for (let i = snapshotDays; i >= 0; i -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) continue
    dates.push(format(date, 'yyyy-MM-dd'))
  }


  state.snapshots = dates.map((date, index) => {
    const progress = dates.length > 1 ? index / (dates.length - 1) : 1
    const wave = Math.sin(index / 4.2) * 0.018 + Math.sin(index / 11.7) * 0.012
    const noise = Math.sin(index * 12.9898) * 0.004
    const growth = 0.86 + progress * 0.14
    const totalAssets = index === dates.length - 1 ? totals.totalAssets : Math.round(totals.totalAssets * (growth + wave + noise))
    const marketValue = Math.max(0, Math.round(totalAssets - totals.cash))
    return {
      date,
      cash: totals.cash,
      marketValue,
      totalAssets,
      cost: Math.round(totals.cost * (0.9 + progress * 0.1)),
      unrealized: Math.round(marketValue - totals.cost * (0.9 + progress * 0.1)),
      realized: Math.round(totals.realized * progress),
      createdAt: stamp(date, '15:10'),
    }
  })

  if (state.snapshots.length >= 2) {
    const previous = state.snapshots[state.snapshots.length - 2]
    const previousAssets = totals.totalAssets - totals.dayPnl
    previous.totalAssets = previousAssets
    previous.marketValue = Math.max(0, previousAssets - previous.cash)
    previous.unrealized = previous.marketValue - previous.cost
  }

  return state
}
