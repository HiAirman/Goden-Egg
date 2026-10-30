import rawStocks from '../data/stocks.json'
import rawEtfs from '../data/etfs.json'

export interface StockInfo {
  symbol: string
  name: string
  ts_code: string
  industry: string
  pinyin: string
  kind?: 'stock' | 'etf'
}

const stockList = (rawStocks as StockInfo[]).map((stock) => ({ ...stock, kind: 'stock' as const }))
const etfList = rawEtfs as StockInfo[]
const stocks = [...stockList, ...etfList]

const POPULAR = [
  '600519',
  '300750',
  '601318',
  '600036',
  '000858',
  '002594',
  '300308',
  '688981',
  '510300',
  '510500',
  '159915',
  '588000',
  '512880',
  '513100',
  '600900',
  '601899',
  '000001',
  '600030',
  '300059',
  '688256',
  '600276',
  '002415',
  '601012',
  '300124',
  '002475',
  '600887',
]

const bySymbol = new Map(stocks.map((stock) => [stock.symbol, stock]))

export function getStockInfo(symbol: string): StockInfo | undefined {
  return bySymbol.get(symbol.replace(/\D/g, '').padStart(6, '0'))
}

export function searchStocks(query: string, limit = 20): StockInfo[] {
  const q = query.trim().toUpperCase()
  if (!q) {
    return POPULAR.map((symbol) => bySymbol.get(symbol))
      .filter((item): item is StockInfo => Boolean(item))
      .slice(0, limit)
  }
  const results: { stock: StockInfo; score: number }[] = []
  for (const stock of stocks) {
    let score = 0
    if (stock.symbol === q) score = 100
    else if (stock.symbol.startsWith(q)) score = 80
    else if (stock.name.includes(query.trim())) score = 60
    else if (stock.pinyin.startsWith(q)) score = 50
    else if (stock.pinyin.includes(q)) score = 30
    if (score > 0) results.push({ stock, score })
    if (results.length > 400) break
  }
  return results
    .sort((a, b) => b.score - a.score || a.stock.symbol.localeCompare(b.stock.symbol))
    .slice(0, limit)
    .map((item) => item.stock)
}

export function sectorForIndustry(industry: string): string {
  const text = industry || ''
  if (/ETF|LOF|REIT/.test(text)) return 'ETF'
  if (/酒|饮料|食品|家电|旅游|零售|纺织|服装|家居/.test(text)) return '消费'
  if (/银行/.test(text)) return '银行'
  if (/保险|证券|多元金融/.test(text)) return '金融'
  if (/半导体|电子|元器件|芯片/.test(text)) return '半导体'
  if (/软件|互联网|通信|IT|计算机/.test(text)) return '人工智能'
  if (/医药|医疗|生物/.test(text)) return '医药'
  if (/电池|光伏|新能源|能源金属/.test(text)) return '新能源'
  if (/汽车|整车|汽配/.test(text)) return '汽车'
  if (/房地产|地产|建筑/.test(text)) return '地产'
  if (/军工|航空|航天/.test(text)) return '军工'
  if (/有色|煤炭|钢铁|化工|石油/.test(text)) return '有色'
  if (/电力|公用事业|燃气/.test(text)) return '电力'
  if (/机械|专用设备|通用设备/.test(text)) return '机械'
  if (/传媒|游戏|影视/.test(text)) return '传媒'
  return '其他'
}
