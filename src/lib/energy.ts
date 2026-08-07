import type { DateStr, DayWeights, LogEntry, Profile, Weekday } from './types'
import { addDays, daysBetween, weekDates, weekdayOf } from './date'

/** 1 kcal = 4.184 kJ exactly (thermochemical calorie, the one food labels use). */
export const KJ_PER_KCAL = 4.184

/**
 * Energy released per kilogram of body tissue lost. The classic figure is 7700 kcal/kg
 * (3500 kcal/lb) for adipose tissue. Real-world loss includes some lean tissue and water,
 * so this slightly *overstates* the deficit needed — which is the safe direction to err.
 */
export const KCAL_PER_KG_TISSUE = 7700
export const KJ_PER_KG_TISSUE = KCAL_PER_KG_TISSUE * KJ_PER_KCAL // 32,216.8 kJ

/** Rates outside this band are flagged: too slow to matter, or fast enough to shed muscle. */
export const SANE_RATE_KG_PER_WEEK = { min: 0.25, max: 1.0 }

/**
 * Thermic effect of food — the energy spent digesting what you eat, about 10% of intake
 * on a mixed diet.
 *
 * This constant exists because of a mistake that is easy to make and expensive to keep.
 * "TDEE" from an activity multiplier is *maintenance intake*, and it therefore already
 * contains TEF calculated on a maintenance-sized meal. Eat less and you also digest less,
 * so expenditure falls by 10% of every kilojoule you cut. Subtracting the target deficit
 * straight off maintenance silently gives back a tenth of it:
 *
 *     naive:   intake = maintenance − deficit
 *     correct: intake = maintenance − deficit / (1 − TEF)
 *
 * For this app's numbers the two differ by roughly 350 kJ a day — around 1 kg over a
 * three-month cut, all of it invisible until the goal date arrives and the scale disagrees.
 */
export const TEF_RATE = 0.1

export function kjToKcal(kj: number): number {
  return kj / KJ_PER_KCAL
}

export function kcalToKj(kcal: number): number {
  return kcal * KJ_PER_KCAL
}

/**
 * Mifflin-St Jeor resting metabolic rate, in kJ/day.
 * Chosen over Harris-Benedict because it is the better-validated equation for
 * non-obese adults, and over Katch-McArdle because that needs a body-fat measurement.
 */
export function bmrKj(profile: Pick<Profile, 'sex' | 'age' | 'heightCm'>, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age
  const kcal = profile.sex === 'male' ? base + 5 : base - 161
  return kcalToKj(kcal)
}

/**
 * Activity multipliers, described by what the week actually looks like rather than by
 * vague labels like "moderately active" that everybody over-estimates.
 */
export const ACTIVITY_LEVELS = [
  { factor: 1.2, label: 'Desk-bound', detail: 'Sitting most of the day, no deliberate exercise' },
  { factor: 1.32, label: 'Barely active', detail: 'A short walk a few times a week, or 1–2 easy gym sessions' },
  { factor: 1.41, label: 'Lightly active', detail: 'A 3–4 km walk most days plus about three easy gym sessions' },
  { factor: 1.5, label: 'Moderately active', detail: 'An hour of walking daily, or 5–6 km, plus three gym sessions' },
  { factor: 1.65, label: 'Very active', detail: 'Hard training most days, or a job that keeps you on your feet' },
] as const

export function activityLabel(factor: number): string {
  let best: (typeof ACTIVITY_LEVELS)[number] = ACTIVITY_LEVELS[0]
  for (const level of ACTIVITY_LEVELS) {
    if (Math.abs(level.factor - factor) < Math.abs(best.factor - factor)) best = level
  }
  return best.label
}

/**
 * Energy cost of a walk over and above just existing, in kJ.
 *
 * 0.5 kcal per kg per km = 2.09 kJ/kg/km. Cross-checks against the MET method: level
 * walking is 3.5 METs, so at 5 km/h and 78.5 kg a 3.4 km walk costs 196 kcal gross and
 * 140 kcal net of the 56 kcal that would have been burnt sitting still — 41 kcal/km,
 * which is 0.52 kcal/kg/km at this bodyweight.
 */
export function walkKj(distanceKm: number, weightKg: number): number {
  return 0.5 * KJ_PER_KCAL * weightKg * distanceKm
}

// ---------------------------------------------------------------------------
// The plan: what to eat to arrive at the goal weight on the goal date
// ---------------------------------------------------------------------------

export type Feasibility = 'comfortable' | 'on-plan' | 'aggressive' | 'not-possible'

export interface PlanSummary {
  currentKg: number
  goalKg: number
  kgToGo: number
  daysToGoal: number
  bmrKj: number
  /** Maintenance intake — what you'd eat to hold this weight. From the equation, or measured. */
  tdeeKj: number
  /** Expenditure excluding digestion, which is the part that doesn't shrink when you eat less. */
  baseBurnKj: number
  tdeeSource: 'formula' | 'measured'
  requiredRateKgPerWeek: number
  requiredDailyDeficitKj: number
  /** What the goal date demands, before the safety floor is applied. */
  rawDailyTargetKj: number
  dailyTargetKj: number
  weeklyTargetKj: number
  floorApplied: boolean
  feasibility: Feasibility
  /**
   * If the floor bites, the date the goal is actually reachable by eating at the floor.
   * Null when the goal date is achievable as asked.
   */
  achievableGoalDate: DateStr | null
  /** Loss rate implied by eating exactly `dailyTargetKj`. */
  projectedRateKgPerWeek: number
}

export interface PlanInput {
  profile: Profile
  /** Smoothed current weight — never a single noisy morning reading. */
  currentKg: number
  asOf: DateStr
  /** Measured non-digestive expenditure, when there is enough data to trust it. */
  baseBurnKj?: number | null
}

export function computePlan({ profile, currentKg, asOf, baseBurnKj }: PlanInput): PlanSummary {
  const bmr = bmrKj(profile, currentKg)

  /*
   * Expenditure falls as you get lighter — a smaller body costs less to run and less to
   * carry around. Averaging today's figure with the one at goal weight removes a bias
   * that would otherwise set targets slightly too generous for the whole cut.
   */
  const maintenanceNow = bmr * profile.activityFactor
  const maintenanceAtGoal = bmrKj(profile, profile.goalKg) * profile.activityFactor
  const formulaMaintenance = (maintenanceNow + maintenanceAtGoal) / 2

  const useMeasured = baseBurnKj != null && baseBurnKj > 0
  // Everything below is expressed as "burn before digestion" so the two sources —
  // the equation and the user's own data — are directly comparable.
  const baseBurn = useMeasured ? (baseBurnKj as number) : formulaMaintenance * (1 - TEF_RATE)
  const maintenanceKj = baseBurn / (1 - TEF_RATE)

  const kgToGo = currentKg - profile.goalKg
  const daysToGoal = Math.max(1, daysBetween(asOf, profile.goalDate))

  const requiredRateKgPerWeek = (kgToGo / daysToGoal) * 7
  const requiredDailyDeficitKj = (kgToGo * KJ_PER_KG_TISSUE) / daysToGoal

  // Solve  baseBurn + TEF·intake − intake = deficit  for intake.
  const rawDailyTargetKj = (baseBurn - requiredDailyDeficitKj) / (1 - TEF_RATE)
  const floorApplied = rawDailyTargetKj < profile.floorKj
  const dailyTargetKj = Math.round(Math.max(rawDailyTargetKj, profile.floorKj))

  const actualDeficit = baseBurn - (1 - TEF_RATE) * dailyTargetKj
  const projectedRateKgPerWeek = (actualDeficit * 7) / KJ_PER_KG_TISSUE

  let achievableGoalDate: DateStr | null = null
  if (floorApplied && actualDeficit > 0 && kgToGo > 0) {
    const daysNeeded = Math.ceil((kgToGo * KJ_PER_KG_TISSUE) / actualDeficit)
    if (daysNeeded < 3650) achievableGoalDate = addDays(asOf, daysNeeded)
  }

  let feasibility: Feasibility
  if (kgToGo <= 0) feasibility = 'comfortable'
  else if (actualDeficit <= 0) feasibility = 'not-possible'
  else if (floorApplied) feasibility = 'not-possible'
  else if (requiredRateKgPerWeek > SANE_RATE_KG_PER_WEEK.max) feasibility = 'not-possible'
  else if (requiredRateKgPerWeek > 0.75) feasibility = 'aggressive'
  else if (requiredRateKgPerWeek < SANE_RATE_KG_PER_WEEK.min) feasibility = 'comfortable'
  else feasibility = 'on-plan'

  return {
    currentKg,
    goalKg: profile.goalKg,
    kgToGo,
    daysToGoal,
    bmrKj: Math.round(bmr),
    tdeeKj: Math.round(maintenanceKj),
    baseBurnKj: Math.round(baseBurn),
    tdeeSource: useMeasured ? 'measured' : 'formula',
    requiredRateKgPerWeek,
    requiredDailyDeficitKj: Math.round(requiredDailyDeficitKj),
    rawDailyTargetKj: Math.round(rawDailyTargetKj),
    dailyTargetKj,
    weeklyTargetKj: dailyTargetKj * 7,
    floorApplied,
    feasibility,
    achievableGoalDate,
    projectedRateKgPerWeek,
  }
}

/**
 * Protein needed to defend lean mass through a deficit: 2.4 g per kg of lean body mass.
 *
 * The often-quoted 1.8 g/kg is for a mild deficit. In a steep one — where the body is
 * actively looking for tissue to burn — the evidence supports 2.3–3.1 g/kg of lean mass,
 * and this sits at the sensible end of that. On any day where the two targets conflict,
 * hitting protein matters more than hitting the kilojoule number.
 */
export function proteinTargetG(weightKg: number, bodyFatPct = 20): number {
  return Math.round(weightKg * (1 - bodyFatPct / 100) * 2.4)
}

/** Below this, a deficit starts eating muscle regardless of training: 1.6 g/kg bodyweight. */
export function proteinFloorG(weightKg: number): number {
  return Math.round(weightKg * 1.6)
}

// ---------------------------------------------------------------------------
// The weekly budget — the part that makes a restaurant Wednesday survivable
// ---------------------------------------------------------------------------

export const DEFAULT_DAY_WEIGHTS: DayWeights = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }

export interface DayBudget {
  date: DateStr
  weekday: Weekday
  /** Share of the week originally planned for this day. */
  plannedKj: number
  /** What today may still have, after redistributing what earlier days actually used. */
  allowanceKj: number
  consumedKj: number
  isPast: boolean
  isToday: boolean
}

export interface WeekBudget {
  weekStart: DateStr
  weekEnd: DateStr
  weeklyTargetKj: number
  consumedKj: number
  remainingKj: number
  /** Cumulative budget that *should* be spent by the end of today, at the planned split. */
  pacedKj: number
  days: DayBudget[]
  today: DayBudget
  daysLeft: number
  /** Earlier days this week with nothing logged. Their budget is assumed spent, not freed. */
  unloggedPastDates: DateStr[]
}

function sumKj(entries: LogEntry[]): number {
  return entries.reduce((total, e) => total + e.kjPerServing * e.servings, 0)
}

export function kjOnDate(log: LogEntry[], date: DateStr): number {
  return sumKj(log.filter((e) => e.date === date))
}

/**
 * Splits the week's energy budget across seven days by weight, then continuously
 * redistributes whatever earlier days left unspent (or overspent) across the days that
 * remain. A 12,000 kJ Wednesday therefore shrinks Thursday–Sunday instead of showing a
 * red failure and inviting him to give up on the week.
 */
export function computeWeekBudget(
  log: LogEntry[],
  weeklyTargetKj: number,
  dayWeights: DayWeights,
  asOf: DateStr,
): WeekBudget {
  const dates = weekDates(asOf)
  const weights = dates.map((d) => Math.max(0.05, dayWeights[weekdayOf(d)] ?? 1))
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const consumedByDate = dates.map((d) => kjOnDate(log, d))
  const todayIndex = dates.indexOf(asOf)
  const plannedByDate = weights.map((w) => (weeklyTargetKj * w) / totalWeight)

  /*
   * A past day with nothing logged is charged its planned share rather than zero.
   *
   * Counting it as zero would be worse than useless: skipping Wednesday's log would hand
   * Wednesday's entire budget to the rest of the week, so the app would literally pay you
   * to stop logging on your biggest day. Assuming the plan was spent keeps the incentive
   * pointing the right way, and the unlogged days are named in the UI so the assumption is
   * visible rather than buried.
   */
  const unloggedPastDates = dates.filter((_, i) => i < todayIndex && consumedByDate[i] === 0)
  const spentBefore = dates
    .slice(0, Math.max(0, todayIndex))
    .reduce((total, _, i) => total + (consumedByDate[i] === 0 ? plannedByDate[i] : consumedByDate[i]), 0)
  const remainingAfterPast = weeklyTargetKj - spentBefore

  const days: DayBudget[] = dates.map((date, i) => {
    const plannedKj = Math.round(plannedByDate[i])
    const isPast = i < todayIndex
    const isToday = i === todayIndex

    let allowanceKj: number
    if (isPast) {
      allowanceKj = plannedKj
    } else {
      const futureWeight = weights.slice(Math.max(0, todayIndex)).reduce((a, b) => a + b, 0)
      allowanceKj = Math.round(Math.max(0, remainingAfterPast) * (weights[i] / futureWeight))
    }

    return {
      date,
      weekday: weekdayOf(date),
      plannedKj,
      allowanceKj,
      consumedKj: Math.round(consumedByDate[i]),
      isPast,
      isToday,
    }
  })

  const consumedKj = Math.round(consumedByDate.reduce((a, b) => a + b, 0))
  const pacedWeight = weights.slice(0, Math.max(0, todayIndex) + 1).reduce((a, b) => a + b, 0)

  return {
    weekStart: dates[0],
    weekEnd: dates[6],
    weeklyTargetKj,
    consumedKj,
    remainingKj: Math.round(weeklyTargetKj - consumedKj),
    pacedKj: Math.round((weeklyTargetKj * pacedWeight) / totalWeight),
    days,
    today: days[Math.max(0, todayIndex)],
    daysLeft: 7 - Math.max(0, todayIndex),
    unloggedPastDates,
  }
}

// ---------------------------------------------------------------------------
// Measured expenditure — trusting the data over the equation
// ---------------------------------------------------------------------------

export interface MeasuredTdee {
  /** Total expenditure observed over the window, at the intake actually eaten. */
  tdeeKj: number
  /**
   * Expenditure with digestion stripped out. This is what the plan needs: it's the part
   * that stays put when intake changes, so a new target can be solved against it.
   */
  baseBurnKj: number
  /** Maintenance intake implied by the measurement — what holding this weight would cost. */
  maintenanceKj: number
  daysUsed: number
  daysLogged: number
  meanIntakeKj: number
  weightChangeKg: number
  confidence: Confidence2
  /** Why it couldn't be measured, when it couldn't. */
  reason?: string
}

type Confidence2 = 'high' | 'medium' | 'low' | 'none'

/**
 * Works expenditure backwards from what actually happened:
 *
 *     expenditure = mean intake + (weight lost × energy per kg) / days
 *
 * Once real data exists this beats any prediction equation for the things the equation
 * guesses at — true metabolic rate and non-exercise movement.
 *
 * It does NOT quietly fix under-reporting, and it would be dangerous to pretend otherwise.
 * Food that never got logged shows up here as low expenditure, indistinguishable from a
 * genuinely slow metabolism. The two need opposite responses — eat less versus log better —
 * so the app reports the gap against the equation as a diagnostic rather than silently
 * lowering the target. Requires a densely logged window for the same reason.
 */
export function measureTdee(
  log: LogEntry[],
  trendKgOn: (date: DateStr) => number | null,
  asOf: DateStr,
  windowDays = 28,
): MeasuredTdee {
  const empty = (reason: string): MeasuredTdee => ({
    tdeeKj: 0,
    baseBurnKj: 0,
    maintenanceKj: 0,
    daysUsed: 0,
    daysLogged: 0,
    meanIntakeKj: 0,
    weightChangeKg: 0,
    confidence: 'none',
    reason,
  })

  const start = addDays(asOf, -(windowDays - 1))
  const startKg = trendKgOn(start)
  const endKg = trendKgOn(asOf)
  if (startKg == null || endKg == null) {
    return empty('Needs weigh-ins at both ends of the window')
  }

  const dates = Array.from({ length: windowDays }, (_, i) => addDays(start, i))
  const perDay = dates.map((d) => kjOnDate(log, d))
  const daysLogged = perDay.filter((kj) => kj > 0).length
  if (daysLogged < Math.ceil(windowDays * 0.6)) {
    return empty(`Only ${daysLogged} of ${windowDays} days logged — need at least ${Math.ceil(windowDays * 0.6)}`)
  }

  // Average over logged days only. Blank days are almost always "forgot to log",
  // not "ate nothing", and counting them as zero would tank the estimate.
  const meanIntakeKj = perDay.reduce((a, b) => a + b, 0) / daysLogged
  const weightChangeKg = startKg - endKg
  const tdee = meanIntakeKj + (weightChangeKg * KJ_PER_KG_TISSUE) / (windowDays - 1)

  const coverage = daysLogged / windowDays
  const confidence: Confidence2 = coverage >= 0.9 ? 'high' : coverage >= 0.75 ? 'medium' : 'low'

  // `tdee` is expenditure while eating `meanIntakeKj`, so its digestive component was
  // sized by that intake. Strip it out to get the burn that survives a change in diet.
  const baseBurnKj = tdee - TEF_RATE * meanIntakeKj

  return {
    tdeeKj: Math.round(tdee),
    baseBurnKj: Math.round(baseBurnKj),
    maintenanceKj: Math.round(baseBurnKj / (1 - TEF_RATE)),
    daysUsed: windowDays,
    daysLogged,
    meanIntakeKj: Math.round(meanIntakeKj),
    weightChangeKg,
    confidence,
  }
}

// ---------------------------------------------------------------------------
// Portions — because nobody weighs their father's curry
// ---------------------------------------------------------------------------

export const PORTION_PRESETS = [
  { label: 'Half', mult: 0.5 },
  { label: 'Small', mult: 0.75 },
  { label: 'Normal', mult: 1 },
  { label: 'Large', mult: 1.4 },
  { label: 'Double', mult: 2 },
] as const

export function portionLabel(mult: number): string {
  const hit = PORTION_PRESETS.find((p) => Math.abs(p.mult - mult) < 0.001)
  return hit ? hit.label : `×${mult.toFixed(2).replace(/\.?0+$/, '')}`
}

// ---------------------------------------------------------------------------
// Streaks — the only gamification worth having
// ---------------------------------------------------------------------------

/** Consecutive days ending today (or yesterday, if today isn't logged yet) with any entry. */
export function loggingStreak(log: LogEntry[], asOf: DateStr): number {
  const logged = new Set(log.map((e) => e.date))
  let cursor = logged.has(asOf) ? asOf : addDays(asOf, -1)
  let streak = 0
  while (logged.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

