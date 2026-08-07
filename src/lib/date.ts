import type { DateStr, Weekday } from './types'

/**
 * Dates are handled as local calendar days, never UTC instants. `new Date('2026-08-07')`
 * parses as UTC midnight and can render as the 6th in Australia, so every conversion here
 * goes through explicit local-time constructors.
 */

export function toDateStr(d: Date): DateStr {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(now: Date = new Date()): DateStr {
  return toDateStr(now)
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = fromDateStr(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** Whole days from `a` to `b`. Positive when `b` is later. */
export function daysBetween(a: DateStr, b: DateStr): number {
  const ms = fromDateStr(b).getTime() - fromDateStr(a).getTime()
  // Round rather than floor: DST shifts make some "days" 23 or 25 hours long.
  return Math.round(ms / 86_400_000)
}

export function weekdayOf(s: DateStr): Weekday {
  return fromDateStr(s).getDay() as Weekday
}

/** Monday-anchored week start, matching how the weekly budget is described. */
export function startOfWeek(s: DateStr): DateStr {
  const dow = weekdayOf(s)
  const back = dow === 0 ? 6 : dow - 1
  return addDays(s, -back)
}

export function endOfWeek(s: DateStr): DateStr {
  return addDays(startOfWeek(s), 6)
}

/** Every date in the Monday–Sunday week containing `s`. */
export function weekDates(s: DateStr): DateStr[] {
  const start = startOfWeek(s)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function isSameWeek(a: DateStr, b: DateStr): boolean {
  return startOfWeek(a) === startOfWeek(b)
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dayName(s: DateStr): string {
  return DAY_NAMES[weekdayOf(s)]
}

export function dayShort(w: Weekday): string {
  return DAY_SHORT[w]
}

/** "Today" / "Yesterday" / "Wed 12 Aug" — the label above the day's log. */
export function friendlyDate(s: DateStr, now: DateStr = today()): string {
  const diff = daysBetween(now, s)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return shortDate(s)
}

export function shortDate(s: DateStr): string {
  const d = fromDateStr(s)
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

export function monthDay(s: DateStr): string {
  const d = fromDateStr(s)
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

export function longDate(s: DateStr): string {
  const d = fromDateStr(s)
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}
