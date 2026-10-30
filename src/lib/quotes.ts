import type { Quote } from '../types'

export function toTencentCode(symbol: string): string {
  const trimmed = symbol.trim().toLowerCase()
  if (/^(sh|sz|bj)\d{6}$/.test(trimmed)) return trimmed
  if (/^\d{6}\.(sh|sz|bj)$/.test(trimmed)) {
    const [code, market] = trimmed.split('.')
    return `${market}${code}`
  }
  if (/^(sh|sz|bj)\.\d{6}$/.test(trimmed)) {
    const [market, code] = trimmed.split('.')
    return `${market}${code}`
  }
  const code = trimmed.replace(/\D/g, '').padStart(6, '0')
  if (/^(5|6|9)/.test(code)) return `sh${code}`
  if (/^(4|8)/.test(code)) return `bj${code}`
  return `sz${code}`
}

export function normalizeSymbol(symbol: string): string {
  const tencent = toTencentCode(symbol)
  return tencent.slice(2)
}

export function isIndexSymbol(symbol: string): boolean {
  return /^(sh000|sz399)/.test(symbol)
}

function parseTencentLine(tencentCode: string, raw: string, now: number): Quote | null {
  const parts = raw.split('~')
  if (parts.length < 6) return null
  const price = Number(parts[3])
  const prevClose = Number(parts[4])
  if (!Number.isFinite(price) || price <= 0) return null
  const change = Number(parts[31])
  const changePct = Number(parts[32])
  return {
    symbol: isIndexSymbol(tencentCode) ? tencentCode : tencentCode.slice(2),
    name: parts[1] || tencentCode,
    price,
    prevClose: prevClose > 0 ? prevClose : price,
    open: Number(parts[5]) || price,
    high: Number(parts[33]) || price,
    low: Number(parts[34]) || price,
    changePct: Number.isFinite(changePct) ? changePct : prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    updatedAt: now,
  }
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('行情请求超时')), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function fetchViaBridge(codes: string[]): Promise<Quote[]> {
  if (!window.goldenEgg?.fetchQuotes) return []
  const quotes = await timeout(window.goldenEgg.fetchQuotes(codes), 12_000)
  return Array.isArray(quotes) ? quotes : []
}

function loadJsonpScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.charset = 'gbk'
    script.src = src
    script.async = true
    const cleanup = () => {
      script.remove()
    }
    script.onload = () => {
      cleanup()
      resolve()
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('行情脚本加载失败'))
    }
    document.head.appendChild(script)
  })
}

async function fetchViaJsonp(codes: string[]): Promise<Quote[]> {
  const url = `https://qt.gtimg.cn/q=${codes.join(',')}&_=${Date.now()}`
  await loadJsonpScript(url)
  const now = Date.now()
  const quotes: Quote[] = []
  for (const code of codes) {
    const raw = (window as unknown as Record<string, unknown>)[`v_${code}`]
    if (typeof raw === 'string') {
      const parsed = parseTencentLine(code, raw, now)
      if (parsed) quotes.push(parsed)
    }
  }
  return quotes
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const codes = [...new Set(symbols.filter(Boolean).map(toTencentCode))]
  if (codes.length === 0) return []
  try {
    const bridged = await fetchViaBridge(codes)
    if (bridged.length > 0) return bridged
  } catch (error) {
    console.warn('桌面行情通道不可用，尝试浏览器通道', error)
  }
  return fetchViaJsonp(codes)
}

export const INDEX_SYMBOLS = ['sh000001', 'sz399001', 'sz399006']
