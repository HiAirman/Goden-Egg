import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'

export const WEEK_OPTS = { weekStartsOn: 1 as const }

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function nowTime(): string {
  return format(new Date(), 'HH:mm')
}

export function toDate(value: string): Date {
  return parseISO(value)
}

export function dateCN(value: string): string {
  if (!value) return '—'
  return format(parseISO(value), 'yyyy年M月d日', { locale: zhCN })
}

export function dateShort(value: string): string {
  if (!value) return '—'
  return format(parseISO(value), 'M月d日', { locale: zhCN })
}

export function dateWithWeek(value: string): string {
  if (!value) return '—'
  return format(parseISO(value), 'M月d日 EEEE', { locale: zhCN })
}

export function timestampDateCN(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy年M月d日 HH:mm', { locale: zhCN })
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return format(new Date(timestamp), 'M月d日', { locale: zhCN })
}

export function mondayOf(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(startOfWeek(date, WEEK_OPTS), 'yyyy-MM-dd')
}

export function weekLabel(weekStart: string): string {
  const start = parseISO(weekStart)
  const end = addDays(start, 6)
  return `${format(start, 'M月d日')} - ${format(end, 'M月d日')}`
}

export function weekDays(weekStart: string): string[] {
  const start = parseISO(weekStart)
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
}

export function monthTitle(month: Date): string {
  return format(month, 'yyyy年M月', { locale: zhCN })
}

export function monthMatrix(month: Date): Date[] {
  const first = startOfMonth(month)
  const gridStart = startOfWeek(first, WEEK_OPTS)
  const last = endOfMonth(month)
  const gridEnd = endOfWeek(last, WEEK_OPTS)
  const days: Date[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

export function shiftMonth(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1)
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

export function isCurrentMonth(date: Date, month: Date): boolean {
  return isSameMonth(date, month)
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(differenceInCalendarDays(parseISO(b), parseISO(a)))
}

export function shiftDate(value: string, delta: number): string {
  return format(addDays(parseISO(value), delta), 'yyyy-MM-dd')
}

export function monthKey(value: string): string {
  return value.slice(0, 7)
}

export function monthShort(key: string): string {
  const [year, month] = key.split('-')
  return `${year.slice(2)}.${month}`
}

export function isWeekend(value: string): boolean {
  const day = parseISO(value).getDay()
  return day === 0 || day === 6
}

export function daysUntil(value: string): number {
  return differenceInCalendarDays(parseISO(value), new Date())
}

export function sortByDateDesc<T extends { date: string; time?: string; createdAt?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const keyA = `${a.date} ${a.time ?? '00:00'}`
    const keyB = `${b.date} ${b.time ?? '00:00'}`
    if (keyA !== keyB) return keyA < keyB ? 1 : -1
    return (b.createdAt ?? 0) - (a.createdAt ?? 0)
  })
}
