import type { DateStr, Profile, WeighIn } from './types'
import { addDays, daysBetween, today } from './date'
import { KJ_PER_KG_TISSUE } from './energy'

/**
 * Daily body weight is mostly noise. A single glass of water, yesterday's salt, and where you
 * are in a digestion cycle move the scale by more than a good week of fat loss does. So every
 * number the app makes a *judgement* on comes from the smoothed trend, never a raw reading.
 */

/**
 * Smoothing factor for the exponentially weighted trend. 0.2 gives roughly a nine-day
 * effective window: responsive enough to show a real change within a fortnight, damped
 * enough that a heavy Sunday dinner doesn't look like failure on Monday.
 */
export const DEFAULT_ALPHA = 0.2

export interface TrendPoint {
  date: DateStr
  /** The reading taken that morning, if there was one. */
  raw: number | null
  /** Smoothed trend weight — defined for every day from the first weigh-in onwards. */
  trend: number
}

/**
 * Builds a continuous daily trend series from sparse weigh-ins.
 * Days without a reading carry the previous trend value forward rather than interpolating,
 * so a gap never invents a measurement that was not taken.
 */
export function buildTrend(weighIns: WeighIn[], alpha = DEFAULT_ALPHA, upTo?: DateStr): TrendPoint[] {
  if (weighIns.length === 0) return []

  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  // A day with two weigh-ins keeps the last one entered.
  const byDate = new Map<DateStr, number>()
  for (const w of sorted) byDate.set(w.date, w.kg)

  const first = sorted[0].date
  const last = upTo && upTo > sorted[sorted.length - 1].date ? upTo : sorted[sorted.length - 1].date
  const span = daysBetween(first, last)

  const points: TrendPoint[] = []
  let ema = byDate.get(first) as number

  for (let i = 0; i <= span; i++) {
    const date = addDays(first, i)
    const raw = byDate.get(date) ?? null
    if (raw != null) ema = i === 0 ? raw : alpha * raw + (1 - alpha) * ema
    points.push({ date, raw, trend: ema })
  }

  return points
}

/** Trend weight on a given day: the value on that day, or the last known one before it. */
export function trendOn(points: TrendPoint[], date: DateStr): number | null {
  if (points.length === 0) return null
  if (date < points[0].date) return null
  let value: number | null = null
  for (const p of points) {
    if (p.date > date) break
    value = p.trend
  }
  return value
}

export function latestTrend(points: TrendPoint[]): number | null {
  return points.length ? points[points.length - 1].trend : null
}

export function latestWeighIn(weighIns: WeighIn[]): WeighIn | null {
  if (weighIns.length === 0) return null
  return [...weighIns].sort((a, b) => a.date.localeCompare(b.date))[weighIns.length - 1]
}

export interface RateEstimate {
  /** Negative means losing. */
  kgPerWeek: number
  /** Weigh-ins the fit is based on. Below ~8 the number is barely meaningful. */
  samples: number
  windowDays: number
  /** How well a straight line fits (0–1). Low means the weight is bouncing, not trending. */
  rSquared: number
  confidence: 'high' | 'medium' | 'low' | 'none'
  /**
   * The fitted line evaluated at `asOf` — an unbiased estimate of today's weight.
   * Null when there wasn't enough data to fit anything.
   */
  fittedKg: number | null
}

/**
 * Least-squares fit through the *raw* weigh-ins in the window.
 *
 * Deliberately not fitted to the smoothed series: an exponential average lags reality by
 * roughly half its window, so a line through it would systematically understate how fast
 * the weight is actually moving. Regression through the raw points has no such lag — the
 * noise the smoothing removes averages out in the fit instead.
 */
export function estimateRate(weighIns: WeighIn[], asOf: DateStr = today(), windowDays = 21): RateEstimate {
  const start = addDays(asOf, -(windowDays - 1))
  const inWindow = weighIns
    .filter((w) => w.date >= start && w.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date))

  const n = inWindow.length
  if (n < 3) {
    return { kgPerWeek: 0, samples: n, windowDays, rSquared: 0, confidence: 'none', fittedKg: null }
  }

  const xs = inWindow.map((w) => daysBetween(start, w.date))
  const ys = inWindow.map((w) => w.kg)
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - meanX) * (ys[i] - meanY)
    sxx += (xs[i] - meanX) ** 2
  }
  if (sxx === 0) {
    return { kgPerWeek: 0, samples: n, windowDays, rSquared: 0, confidence: 'none', fittedKg: null }
  }

  const slope = sxy / sxx // kg per day
  const intercept = meanY - slope * meanX

  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * xs[i]
    ssRes += (ys[i] - predicted) ** 2
    ssTot += (ys[i] - meanY) ** 2
  }
  const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot)

  const spanDays = xs[n - 1] - xs[0]
  let confidence: RateEstimate['confidence']
  if (n >= 10 && spanDays >= 14) confidence = 'high'
  else if (n >= 6 && spanDays >= 10) confidence = 'medium'
  else confidence = 'low'

  return {
    kgPerWeek: slope * 7,
    samples: n,
    windowDays,
    rSquared,
    confidence,
    fittedKg: intercept + slope * daysBetween(start, asOf),
  }
}

/**
 * Best estimate of what you weigh today.
 *
 * Prefers the regression line evaluated at today over the smoothed trend, because an
 * exponential average of a falling weight always reads high: it lags by roughly
 * (1 − α)/α days, which at these settings is about four days, or 0.4 kg at a normal rate
 * of loss. That is the same size as the tolerance used to judge whether someone is on
 * schedule — so trusting the smoothed value would tell a person who is losing weight
 * exactly on plan that they are falling behind, every single week.
 *
 * The smoothed series is still what gets drawn. It's the right thing to *look* at; it's
 * the wrong thing to *judge* against.
 */
export function currentWeightKg(weighIns: WeighIn[], asOf: DateStr = today()): number | null {
  const rate = estimateRate(weighIns, asOf)
  if (rate.confidence !== 'none' && rate.fittedKg != null) return rate.fittedKg

  const points = buildTrend(weighIns, DEFAULT_ALPHA, asOf)
  const smoothed = trendOn(points, asOf)
  if (smoothed != null) return smoothed

  return latestWeighIn(weighIns)?.kg ?? null
}

/** The straight line from the starting weight to the goal — what "on schedule" means. */
export function goalLineKg(profile: Profile, date: DateStr): number {
  const total = daysBetween(profile.startDate, profile.goalDate)
  if (total <= 0) return profile.goalKg
  const elapsed = daysBetween(profile.startDate, date)
  const fraction = Math.min(1, Math.max(0, elapsed / total))
  return profile.startKg + (profile.goalKg - profile.startKg) * fraction
}

export interface Projection {
  /** When the current rate reaches the goal weight. Null if not losing. */
  date: DateStr | null
  daysAway: number | null
  /** Positive = above the goal line (behind schedule); negative = ahead of it. */
  offGoalLineKg: number
  status: 'ahead' | 'on-track' | 'slightly-behind' | 'behind' | 'no-data' | 'gaining'
  kgPerWeek: number
  confidence: RateEstimate['confidence']
}

/**
 * `toleranceKg` allows for the fact that the trend itself carries roughly ±0.3 kg of
 * measurement slop. Calling someone "behind" over less than that is noise, not information.
 */
export function project(
  weighIns: WeighIn[],
  profile: Profile,
  asOf: DateStr = today(),
  toleranceKg = 0.4,
): Projection {
  const rate = estimateRate(weighIns, asOf)
  const current = currentWeightKg(weighIns, asOf)

  if (current == null || rate.confidence === 'none') {
    return {
      date: null,
      daysAway: null,
      offGoalLineKg: current == null ? 0 : current - goalLineKg(profile, asOf),
      status: 'no-data',
      kgPerWeek: rate.kgPerWeek,
      confidence: rate.confidence,
    }
  }

  const offGoalLineKg = current - goalLineKg(profile, asOf)

  let date: DateStr | null = null
  let daysAway: number | null = null
  if (rate.kgPerWeek < -0.02 && current > profile.goalKg) {
    const kgPerDay = -rate.kgPerWeek / 7
    daysAway = Math.ceil((current - profile.goalKg) / kgPerDay)
    if (daysAway < 3650) date = addDays(asOf, daysAway)
    else daysAway = null
  } else if (current <= profile.goalKg) {
    date = asOf
    daysAway = 0
  }

  let status: Projection['status']
  if (rate.kgPerWeek > 0.05) status = 'gaining'
  else if (offGoalLineKg <= -toleranceKg) status = 'ahead'
  else if (offGoalLineKg <= toleranceKg) status = 'on-track'
  else if (offGoalLineKg <= toleranceKg * 3) status = 'slightly-behind'
  else status = 'behind'

  /*
   * Position and pace are different questions, and early in a plan they disagree: on day
   * three you are still sitting on the goal line no matter how slowly you're losing.
   * Once the rate is trustworthy it gets a veto, so the app can't badge someone "on track"
   * next to a projection that lands two months after their deadline.
   */
  if (
    (status === 'ahead' || status === 'on-track') &&
    rate.confidence === 'high' &&
    date != null &&
    daysBetween(profile.goalDate, date) > 14
  ) {
    status = 'slightly-behind'
  }

  return { date, daysAway, offGoalLineKg, status, kgPerWeek: rate.kgPerWeek, confidence: rate.confidence }
}

/**
 * How much the daily budget would have to change to land exactly on the goal date, given
 * the loss rate actually being achieved. Turns "you're behind" into "eat 380 kJ less a day".
 */
export function budgetCorrectionKj(
  currentKg: number,
  profile: Profile,
  asOf: DateStr = today(),
  actualRateKgPerWeek = 0,
): number {
  const daysLeft = Math.max(1, daysBetween(asOf, profile.goalDate))
  const requiredKgPerWeek = ((currentKg - profile.goalKg) / daysLeft) * 7
  const shortfallKgPerWeek = requiredKgPerWeek + actualRateKgPerWeek // rate is negative when losing
  return Math.round((shortfallKgPerWeek * KJ_PER_KG_TISSUE) / 7)
}
