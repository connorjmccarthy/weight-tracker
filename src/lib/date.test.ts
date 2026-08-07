import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, endOfWeek, friendlyDate, startOfWeek, toDateStr, weekDates, weekdayOf } from './date'

describe('local calendar dates', () => {
  it('formats a local Date without drifting through UTC', () => {
    // Constructed at 00:30 local. A UTC round-trip would render this as the day before
    // anywhere east of Greenwich — including Australia.
    expect(toDateStr(new Date(2026, 7, 7, 0, 30))).toBe('2026-08-07')
  })

  it('rolls over month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('counts the plan window correctly in a non-leap year', () => {
    expect(daysBetween('2026-08-07', '2026-11-01')).toBe(86)
    expect(daysBetween('2026-11-01', '2026-08-07')).toBe(-86)
    expect(daysBetween('2026-08-07', '2026-08-07')).toBe(0)
  })

  it('handles February in both leap and common years', () => {
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29)
    expect(daysBetween('2026-02-01', '2026-03-01')).toBe(28)
  })

  it('survives a daylight-saving transition', () => {
    // Australian DST starts on the first Sunday in October. A 23-hour "day" would floor
    // to zero if the difference were truncated instead of rounded.
    expect(daysBetween('2026-10-03', '2026-10-05')).toBe(2)
    expect(daysBetween('2026-04-04', '2026-04-06')).toBe(2)
  })
})

describe('weeks', () => {
  it('anchors weeks to Monday', () => {
    expect(startOfWeek('2026-08-12')).toBe('2026-08-10') // Wednesday → Monday
    expect(startOfWeek('2026-08-10')).toBe('2026-08-10') // Monday → itself
  })

  it('treats Sunday as the end of the week, not the start', () => {
    expect(startOfWeek('2026-08-16')).toBe('2026-08-10')
    expect(endOfWeek('2026-08-10')).toBe('2026-08-16')
  })

  it('lists seven consecutive days', () => {
    const dates = weekDates('2026-08-12')
    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe('2026-08-10')
    expect(dates[6]).toBe('2026-08-16')
    expect(dates.map(weekdayOf)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })
})

describe('friendlyDate', () => {
  it('names the days around today', () => {
    expect(friendlyDate('2026-08-07', '2026-08-07')).toBe('Today')
    expect(friendlyDate('2026-08-06', '2026-08-07')).toBe('Yesterday')
    expect(friendlyDate('2026-08-08', '2026-08-07')).toBe('Tomorrow')
  })

  it('falls back to a short date further out', () => {
    expect(friendlyDate('2026-08-01', '2026-08-07')).toBe('Sat 1 Aug')
  })
})
