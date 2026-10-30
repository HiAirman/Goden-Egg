const moneyFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2,
})

export function formatMoney(value: number, options?: { sign?: boolean; decimals?: number }): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const digits = options?.decimals ?? 2
  const body =
    digits === 2
      ? moneyFormatter.format(abs)
      : new Intl.NumberFormat('zh-CN', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(abs)
  const sign = value < 0 ? '-' : options?.sign && value > 0 ? '+' : ''
  return `${sign}${body}`
}

export function formatCurrency(value: number, options?: { sign?: boolean }): string {
  if (!Number.isFinite(value)) return '—'
  return `¥ ${formatMoney(value, options)}`
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${numberFormatter.format(abs / 100_000_000)}亿`
  if (abs >= 10_000) return `${sign}${numberFormatter.format(abs / 10_000)}万`
  return `${sign}${numberFormatter.format(abs)}`
}

export function formatPct(value: number, options?: { sign?: boolean; digits?: number }): string {
  if (!Number.isFinite(value)) return '—'
  const digits = options?.digits ?? 2
  const sign = value > 0 && options?.sign !== false ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value >= 1000 ? value.toFixed(2) : value.toFixed(2)
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function formatSigned(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${formatMoney(value)}`
}

export function formatSignedCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : '-'}¥ ${formatMoney(Math.abs(value))}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function safeNumber(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

export function pnlClass(value: number): string {
  if (value > 0.000001) return 'is-up'
  if (value < -0.000001) return 'is-down'
  return 'is-flat'
}

export function pnlTone(value: number): 'up' | 'down' | 'flat' {
  if (value > 0.000001) return 'up'
  if (value < -0.000001) return 'down'
  return 'flat'
}
