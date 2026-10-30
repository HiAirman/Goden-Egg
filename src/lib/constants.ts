export const EMOTIONS = [
  { value: '冷静', color: '#2f6b4f' },
  { value: '自信', color: '#3b7d5f' },
  { value: '犹豫', color: '#b07c36' },
  { value: '急躁', color: '#c26a45' },
  { value: '贪婪', color: '#a8483f' },
  { value: '恐惧', color: '#7a5a8f' },
  { value: '后悔', color: '#8a6d55' },
  { value: '中性', color: '#7b8178' },
] as const

export const REASON_TAGS = [
  '计划内',
  '突破买入',
  '回踩支撑',
  '趋势跟随',
  '业绩超预期',
  '消息驱动',
  '估值修复',
  '分批建仓',
  '止盈',
  '纪律止损',
  '移动止盈',
  '补仓摊薄',
  '调仓换股',
  '情绪交易',
  '跟风',
]

export const REVIEW_TAGS = [
  '执行到位',
  '冲动交易',
  '错过机会',
  '仓位过重',
  '止损及时',
  '研究不足',
  '节奏良好',
  '需要耐心',
]

export const EVENT_LABELS: Record<string, string> = {
  review: '复盘',
  trade: '交易',
  earnings: '财报',
  unlock: '解禁',
  macro: '宏观',
  custom: '自定义',
}

export const EVENT_COLORS: Record<string, string> = {
  review: '#2f6b4f',
  trade: '#b07c36',
  earnings: '#4e6b8a',
  unlock: '#a8483f',
  macro: '#7a5a8f',
  custom: '#7b8178',
}

export const SECTORS = [
  '消费',
  '白酒',
  '新能源',
  '半导体',
  '人工智能',
  '医药',
  '金融',
  '银行',
  '保险',
  '地产',
  '军工',
  '有色',
  '煤炭',
  '化工',
  '汽车',
  '机械',
  '传媒',
  '通信',
  '电力',
  '其他',
]

export const ACCOUNT_COLORS = ['#2f6b4f', '#b07c36', '#4e6b8a', '#a8483f', '#6f5b8a', '#3b7d7d']

export const INDEX_DEFS = [
  { name: '上证指数', code: 'sh000001', tencent: 'sh000001' },
  { name: '深证成指', code: 'sz399001', tencent: 'sz399001' },
  { name: '创业板指', code: 'sz399006', tencent: 'sz399006' },
]

export const DEFAULT_SETTINGS = {
  commissionRate: 0.00025,
  minCommission: 5,
  stampTaxRate: 0.0005,
  transferFeeRate: 0.00001,
  autoRefreshQuotes: true,
  ai: {
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
  },
}
