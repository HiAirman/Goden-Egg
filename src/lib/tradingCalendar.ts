import { addDays, format, getDay, parseISO } from 'date-fns'
import holidayData from '../data/market-holidays.json'
import { todayStr } from './dates'

interface Holiday {
  date: string
  name: string
}

const holidayMap = new Map<string, string>(
  (holidayData as { holidays: Holiday[] }).holidays.map((item) => [item.date, item.name]),
)

export const MARKET_HOLIDAY_SOURCE = (holidayData as { source: string }).source
export const MARKET_HOLIDAY_UPDATED_AT = (holidayData as { updatedAt: string }).updatedAt

export const TRADING_SESSIONS = [
  { start: 9 * 60 + 30, end: 11 * 60 + 30, label: '上午 09:30–11:30' },
  { start: 13 * 60, end: 15 * 60, label: '下午 13:00–15:00' },
]

export function toMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!match) return NaN
  return Number(match[1]) * 60 + Number(match[2])
}

export function isWeekendDate(date: string): boolean {
  if (!date) return false
  const day = getDay(parseISO(date))
  return day === 0 || day === 6
}

export function holidayName(date: string): string | null {
  return holidayMap.get(date) ?? null
}

export function isTradingDay(date: string): boolean {
  if (!date) return false
  if (isWeekendDate(date)) return false
  return !holidayMap.has(date)
}

export function restDayLabel(date: string): string {
  const holiday = holidayName(date)
  if (holiday) return `${holiday}休市`
  if (isWeekendDate(date)) return '周末休市'
  return ''
}

export function shiftTradingDay(date: string, direction: 1 | -1): string {
  let cursor = parseISO(date)
  for (let i = 0; i < 400; i += 1) {
    cursor = addDays(cursor, direction)
    const value = format(cursor, 'yyyy-MM-dd')
    if (isTradingDay(value)) return value
  }
  return date
}

export function previousTradingDay(date: string): string {
  return shiftTradingDay(date, -1)
}

export function nextTradingDay(date: string): string {
  return shiftTradingDay(date, 1)
}

export function latestTradingDay(date = todayStr()): string {
  return isTradingDay(date) ? date : previousTradingDay(date)
}

export function isTradingTime(time: string): boolean {
  const minutes = toMinutes(time)
  if (!Number.isFinite(minutes)) return false
  return TRADING_SESSIONS.some((session) => minutes >= session.start && minutes <= session.end)
}

export function isTradingMoment(date: string, time: string, now = new Date()): boolean {
  if (!isTradingDay(date)) return false
  if (!isTradingTime(time)) return false
  const today = todayStr()
  if (date > today) return false
  if (date < today) return true
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return toMinutes(time) <= nowMinutes
}

export function suggestedTradeDate(now = new Date()): string {
  const today = todayStr()
  if (!isTradingDay(today)) return previousTradingDay(today)
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (minutes < TRADING_SESSIONS[0].start) return previousTradingDay(today)
  return today
}

export function suggestedTradeTime(date: string, now = new Date()): string {
  const today = todayStr()
  if (date !== today) return '10:00'
  const minutes = now.getHours() * 60 + now.getMinutes()
  const session = TRADING_SESSIONS.find((item) => minutes >= item.start && minutes <= item.end)
  if (session) return format(now, 'HH:mm')
  if (minutes < TRADING_SESSIONS[0].start) return '10:00'
  if (minutes > TRADING_SESSIONS[0].end && minutes < TRADING_SESSIONS[1].start) return '11:30'
  return '14:30'
}

export function marketDayHint(date: string): string {
  if (isTradingDay(date)) return 'A股交易日'
  return restDayLabel(date) || '休市日'
}

export function holidayCountForYear(year: number): number {
  return [...holidayMap.keys()].filter((date) => date.startsWith(`${year}-`)).length
}
