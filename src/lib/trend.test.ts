import { describe, expect, it } from 'vitest'
import { buildTrend, currentWeightKg, estimateRate, goalLineKg, latestTrend, project, trendOn } from './trend'
import type { Profile, WeighIn } from './types'
import { DEFAULT_PROFILE } from '../data/profile'
import { addDays } from './date'

const profile: Profile = { ...DEFAULT_PROFILE }

/** A run of daily weigh-ins with a fixed drift and an optional repeating noise pattern. */
function series(startDate: string, startKg: number, perDay: number, days: number, noise: number[] = [0]): WeighIn[] {
  return Array.from({ length: days }, (_, i) => ({
    date: addDays(startDate, i),
    kg: Math.round((startKg + perDay * i + noise[i % noise.length]) * 10) / 10,
    at: i,
  }))
}

describe('buildTrend', () => {
  it('returns nothing without weigh-ins', () => {
    expect(buildTrend([])).toEqual([])
  })

  it('starts the trend at the first reading rather than easing up to it', () => {
    const points = buildTrend(series('2026-08-01', 78.5, 0, 5))
    expect(points[0].trend).toBe(78.5)
  })

  it('smooths noise far below the raw swing', () => {
    // ±1 kg of water sloshing around a flat 78.5 kg.
    const points = buildTrend(series('2026-08-01', 78.5, 0, 40, [1, -1, 0.6, -0.8, 0.2]))
    const trendValues = points.slice(20).map((p) => p.trend)
    const spread = Math.max(...trendValues) - Math.min(...trendValues)
    expect(spread).toBeLessThan(0.5)
  })

  it('tracks a real trend rather than flattening it', () => {
    const points = buildTrend(series('2026-08-01', 78.5, -0.1, 40))
    const last = latestTrend(points)!
    // A 9-day effective window lags by roughly half of it; the trend should be close
    // to the real weight, not stuck near the start.
    expect(last).toBeGreaterThan(74.5)
    expect(last).toBeLessThan(75.5)
  })

  it('carries the last value across gaps instead of inventing readings', () => {
    const weighIns: WeighIn[] = [
      { date: '2026-08-01', kg: 78.5, at: 0 },
      { date: '2026-08-10', kg: 78.0, at: 1 },
    ]
    const points = buildTrend(weighIns)
    expect(points).toHaveLength(10)
    for (const p of points.slice(1, 9)) {
      expect(p.raw).toBeNull()
      expect(p.trend).toBe(78.5)
    }
  })

  it('keeps the last reading when a day is weighed twice', () => {
    const points = buildTrend([
      { date: '2026-08-01', kg: 78.5, at: 0 },
      { date: '2026-08-02', kg: 80.0, at: 1 },
      { date: '2026-08-02', kg: 78.4, at: 2 },
    ])
    expect(points[1].raw).toBe(78.4)
  })
})

describe('trendOn', () => {
  const points = buildTrend(series('2026-08-01', 78.5, -0.1, 10))

  it('is null before any data exists', () => {
    expect(trendOn(points, '2026-07-01')).toBeNull()
  })

  it('returns the last known value for a date past the end', () => {
    expect(trendOn(points, '2026-12-01')).toBe(latestTrend(points))
  })
})

describe('estimateRate', () => {
  it('says nothing with fewer than three readings', () => {
    expect(estimateRate(series('2026-08-01', 78.5, -0.1, 2), '2026-08-02').confidence).toBe('none')
  })

  it('recovers a known rate', () => {
    const weighIns = series('2026-08-01', 78.5, -0.1, 21)
    const rate = estimateRate(weighIns, '2026-08-21')
    expect(rate.kgPerWeek).toBeCloseTo(-0.7, 1)
    expect(rate.confidence).toBe('high')
    expect(rate.rSquared).toBeGreaterThan(0.99)
  })

  it('recovers the rate through heavy noise', () => {
    const weighIns = series('2026-08-01', 78.5, -0.1, 21, [1.2, -0.9, 0.4, -1.1, 0.7])
    const rate = estimateRate(weighIns, '2026-08-21')
    expect(rate.kgPerWeek).toBeCloseTo(-0.7, 0)
  })

  it('does not lag the way a fit through the smoothed series would', () => {
    // Regression is run on raw readings precisely so it has no smoothing lag.
    const weighIns = series('2026-08-01', 78.5, -0.1, 21)
    const raw = estimateRate(weighIns, '2026-08-21')
    const points = buildTrend(weighIns)
    const smoothedAsWeighIns: WeighIn[] = points.map((p, i) => ({ date: p.date, kg: p.trend, at: i }))
    const smoothed = estimateRate(smoothedAsWeighIns, '2026-08-21')
    expect(Math.abs(raw.kgPerWeek)).toBeGreaterThan(Math.abs(smoothed.kgPerWeek))
  })

  it('reports a gain as a gain', () => {
    expect(estimateRate(series('2026-08-01', 78.5, 0.05, 21), '2026-08-21').kgPerWeek).toBeGreaterThan(0)
  })
})

describe('goalLineKg', () => {
  it('anchors both ends', () => {
    expect(goalLineKg(profile, profile.startDate)).toBe(profile.startKg)
    expect(goalLineKg(profile, profile.goalDate)).toBe(profile.goalKg)
  })

  it('is flat outside the plan window rather than extrapolating', () => {
    expect(goalLineKg(profile, '2026-01-01')).toBe(profile.startKg)
    expect(goalLineKg(profile, '2027-01-01')).toBe(profile.goalKg)
  })

  it('is halfway at the halfway point', () => {
    expect(goalLineKg(profile, '2026-09-19')).toBeCloseTo((78.5 + 70) / 2, 1)
  })
})

describe('project', () => {
  it('says so plainly when there is nothing to go on', () => {
    expect(project([], profile, '2026-08-07').status).toBe('no-data')
  })

  it('calls a fast loss ahead of schedule', () => {
    const weighIns = series('2026-08-07', 78.5, -0.15, 21)
    const p = project(weighIns, profile, '2026-08-27')
    expect(p.status).toBe('ahead')
    expect(p.offGoalLineKg).toBeLessThan(0)
    expect(p.date).not.toBeNull()
  })

  it('calls a slow loss behind schedule', () => {
    const weighIns = series('2026-08-07', 78.5, -0.01, 21)
    const p = project(weighIns, profile, '2026-08-27')
    expect(['slightly-behind', 'behind']).toContain(p.status)
    expect(p.offGoalLineKg).toBeGreaterThan(0)
  })

  it('flags a gain', () => {
    expect(project(series('2026-08-07', 78.5, 0.05, 21), profile, '2026-08-27').status).toBe('gaining')
  })

  it('does not project a finish date while gaining', () => {
    expect(project(series('2026-08-07', 78.5, 0.05, 21), profile, '2026-08-27').date).toBeNull()
  })

  it('tolerates noise around the goal line without crying failure', () => {
    // Exactly on schedule, with a kilo of water noise on top.
    const perDay = (70 - 78.5) / 86
    const weighIns = series('2026-08-07', 78.5, perDay, 21, [0.9, -0.7, 0.3, -1.0, 0.5])
    expect(project(weighIns, profile, '2026-08-27').status).toBe('on-track')
  })
})

describe('currentWeightKg', () => {
  it('is unbiased while weight is falling, where the smoothed trend reads high', () => {
    const perDay = -0.1
    const weighIns = series('2026-08-01', 78.5, perDay, 21)
    const trueNow = 78.5 + perDay * 20

    const unbiased = currentWeightKg(weighIns, '2026-08-21')!
    const smoothed = latestTrend(buildTrend(weighIns, undefined, '2026-08-21'))!

    expect(unbiased).toBeCloseTo(trueNow, 1)
    // The smoothed value lags by roughly four days' worth of loss.
    expect(smoothed - trueNow).toBeGreaterThan(0.25)
    expect(Math.abs(unbiased - trueNow)).toBeLessThan(Math.abs(smoothed - trueNow))
  })

  it('falls back to the smoothed value when there is too little to fit', () => {
    const weighIns: WeighIn[] = [{ date: '2026-08-01', kg: 78.5, at: 0 }]
    expect(currentWeightKg(weighIns, '2026-08-01')).toBe(78.5)
  })

  it('is null with no data at all', () => {
    expect(currentWeightKg([], '2026-08-01')).toBeNull()
  })
})

describe('position versus pace', () => {
  it('does not badge someone on track next to a projection past their deadline', () => {
    // Sitting on the goal line on day one of the plan, but losing at half the needed rate.
    // The plan starts today at exactly the weight the fit says he is now.
    const onPlanStart = { ...profile, startDate: '2026-08-07', startKg: 77.9 }
    const weighIns = series('2026-07-18', 78.9, -0.05, 21)
    const p = project(weighIns, onPlanStart, '2026-08-07')

    expect(Math.abs(p.offGoalLineKg)).toBeLessThan(0.3) // on the line…
    expect(p.date! > onPlanStart.goalDate).toBe(true) // …but arriving late
    expect(p.status).toBe('slightly-behind')
  })

  it('still says ahead when the pace will comfortably beat the deadline', () => {
    const weighIns = series('2026-07-18', 78.9, -0.15, 21)
    const p = project(weighIns, { ...profile, startDate: '2026-08-07' }, '2026-08-07')
    expect(p.date! <= profile.goalDate).toBe(true)
    expect(['ahead', 'on-track']).toContain(p.status)
  })
})
