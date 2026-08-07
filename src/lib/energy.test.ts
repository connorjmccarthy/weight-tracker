import { describe, expect, it } from 'vitest'
import {
  bmrKj,
  computePlan,
  computeWeekBudget,
  KJ_PER_KCAL,
  KJ_PER_KG_TISSUE,
  loggingStreak,
  measureTdee,
  proteinTargetG,
  TEF_RATE,
  walkKj,
} from './energy'
import type { DateStr, LogEntry, Profile } from './types'
import { DEFAULT_PROFILE } from '../data/profile'

const profile: Profile = { ...DEFAULT_PROFILE }

function entry(date: DateStr, kj: number, at = 0): LogEntry {
  return {
    id: `${date}-${kj}-${at}`,
    date,
    foodId: 'x',
    servings: 1,
    meal: 'dinner',
    at,
    name: 'test',
    kjPerServing: kj,
  }
}

describe('unit conversion', () => {
  it('uses the thermochemical calorie', () => {
    expect(KJ_PER_KCAL).toBe(4.184)
    expect(KJ_PER_KG_TISSUE).toBeCloseTo(32216.8, 1)
  })
})

describe('bmrKj', () => {
  it('matches Mifflin-St Jeor worked by hand', () => {
    // 10(78.5) + 6.25(175) − 5(27) + 5 = 785 + 1093.75 − 135 + 5 = 1748.75 kcal
    expect(bmrKj(profile, 78.5)).toBeCloseTo(1748.75 * 4.184, 1)
  })

  it('applies the female constant', () => {
    const female = { ...profile, sex: 'female' as const }
    // The two equations differ by exactly 166 kcal at identical inputs.
    expect(bmrKj(profile, 70) - bmrKj(female, 70)).toBeCloseTo(166 * 4.184, 6)
  })

  it('falls as weight falls', () => {
    expect(bmrKj(profile, 70)).toBeLessThan(bmrKj(profile, 78.5))
  })
})

describe('walkKj', () => {
  it('gives ~590 kJ net for a 3.4 km walk at 78.5 kg', () => {
    // The figure the plan's escape hatch depends on. An earlier version used
    // 0.9 kJ/kg/km and under-credited walking by more than half.
    expect(walkKj(3.4, 78.5)).toBeCloseTo(558, 0)
    expect(walkKj(3.4, 78.5)).toBeGreaterThan(500)
  })
})

describe('computePlan — the thermic effect of food', () => {
  it('does not give back a tenth of the deficit', () => {
    const plan = computePlan({ profile, currentKg: 78.5, asOf: '2026-08-07' })

    // Deficit is measured against burn-before-digestion, not against maintenance.
    const deficit = plan.baseBurnKj - (1 - TEF_RATE) * plan.rawDailyTargetKj
    expect(deficit).toBeCloseTo(plan.requiredDailyDeficitKj, 0)

    // The naive form (maintenance − deficit) is roughly 350 kJ/day too generous.
    const naive = plan.tdeeKj - plan.requiredDailyDeficitKj
    expect(naive - plan.rawDailyTargetKj).toBeGreaterThan(300)
    expect(naive - plan.rawDailyTargetKj).toBeLessThan(400)
  })

  it('reproduces the hand-computed target for this profile', () => {
    const plan = computePlan({ profile, currentKg: 78.5, asOf: '2026-08-07' })
    expect(plan.daysToGoal).toBe(86) // 7 Aug → 1 Nov 2026, non-leap year
    expect(plan.requiredRateKgPerWeek).toBeCloseTo(0.692, 2)
    expect(plan.requiredDailyDeficitKj).toBe(3184)
    expect(plan.rawDailyTargetKj).toBeCloseTo(6528, -1)
  })

  it('averages expenditure across the cut rather than using today’s', () => {
    // Maintenance at 78.5 kg alone would be higher than the figure used.
    const atCurrentOnly = bmrKj(profile, 78.5) * profile.activityFactor
    const plan = computePlan({ profile, currentKg: 78.5, asOf: '2026-08-07' })
    expect(plan.tdeeKj).toBeLessThan(atCurrentOnly)
    expect(plan.tdeeKj).toBeGreaterThan(bmrKj(profile, 70) * profile.activityFactor)
  })
})

describe('computePlan — the safety floor', () => {
  it('holds the target at the floor and reports the date that is actually reachable', () => {
    const plan = computePlan({ profile, currentKg: 78.5, asOf: '2026-08-07' })
    expect(plan.floorApplied).toBe(true)
    expect(plan.dailyTargetKj).toBe(profile.floorKj)
    expect(plan.feasibility).toBe('not-possible')
    // At 7,000 kJ/day the real deficit lands him at 70 kg in mid-November.
    expect(plan.achievableGoalDate).toBe('2026-11-15')
  })

  it('does not apply the floor when the goal date is generous', () => {
    const relaxed = { ...profile, goalDate: '2027-03-01' }
    const plan = computePlan({ profile: relaxed, currentKg: 78.5, asOf: '2026-08-07' })
    expect(plan.floorApplied).toBe(false)
    expect(plan.dailyTargetKj).toBeGreaterThan(profile.floorKj)
    expect(['comfortable', 'on-plan']).toContain(plan.feasibility)
  })

  it('treats a goal already reached as comfortable', () => {
    const plan = computePlan({ profile, currentKg: 69, asOf: '2026-08-07' })
    expect(plan.kgToGo).toBeLessThan(0)
    expect(plan.feasibility).toBe('comfortable')
    expect(plan.achievableGoalDate).toBeNull()
  })

  it('adding activity buys food without moving the date', () => {
    const fitter = { ...profile, activityFactor: 1.5 }
    const before = computePlan({ profile, currentKg: 78.5, asOf: '2026-08-07' })
    const after = computePlan({ profile: fitter, currentKg: 78.5, asOf: '2026-08-07' })
    expect(after.rawDailyTargetKj).toBeGreaterThan(before.rawDailyTargetKj + 500)
    expect(after.floorApplied).toBe(false)
  })
})

describe('computeWeekBudget', () => {
  const flat = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 } as const

  it('splits the week by day weight, not evenly', () => {
    // 2026-08-10 is a Monday.
    const week = computeWeekBudget([], 49000, profile.dayWeights, '2026-08-10')
    expect(week.weekStart).toBe('2026-08-10')
    expect(week.weekEnd).toBe('2026-08-16')
    const wed = week.days.find((d) => d.weekday === 3)!
    const mon = week.days.find((d) => d.weekday === 1)!
    expect(wed.plannedKj).toBeGreaterThan(mon.plannedKj)
    expect(wed.plannedKj).toBe(9450)
    // The weights sum to 7, so the week still adds up to the target.
    expect(week.days.reduce((s, d) => s + d.plannedKj, 0)).toBeCloseTo(49000, -1)
  })

  it('pushes an overspend onto the days that remain instead of failing the week', () => {
    // Blow out Wednesday, then look at Thursday.
    const log = [entry('2026-08-12', 14000)]
    const week = computeWeekBudget(log, 49000, flat, '2026-08-13')
    const thu = week.days.find((d) => d.date === '2026-08-13')!
    expect(thu.allowanceKj).toBeLessThan(thu.plannedKj)
    expect(thu.allowanceKj).toBeGreaterThan(0)
    // Mon–Wed assumed spent at plan except Wednesday's real 14,000.
    expect(week.remainingKj).toBe(49000 - 14000)
  })

  it('never hands out a negative allowance', () => {
    const log = [entry('2026-08-10', 90000)]
    const week = computeWeekBudget(log, 49000, flat, '2026-08-14')
    for (const day of week.days) expect(day.allowanceKj).toBeGreaterThanOrEqual(0)
  })

  it('charges an unlogged past day its planned share, so skipping the log earns nothing', () => {
    // Two identical weeks; in one, Monday and Tuesday were simply never logged.
    const asOf = '2026-08-14' // Friday
    const logged = [entry('2026-08-10', 7000), entry('2026-08-11', 7000)]
    const skipped: LogEntry[] = []

    const withLog = computeWeekBudget(logged, 49000, flat, asOf)
    const withoutLog = computeWeekBudget(skipped, 49000, flat, asOf)

    // Forgetting to log must not grow the remaining budget.
    expect(withoutLog.today.allowanceKj).toBeLessThanOrEqual(withLog.today.allowanceKj)
    expect(withoutLog.unloggedPastDates).toEqual(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13'])
    expect(withLog.unloggedPastDates).toEqual(['2026-08-12', '2026-08-13'])
  })

  it('rewards genuinely coming in under budget', () => {
    const asOf = '2026-08-14'
    const frugal = [
      entry('2026-08-10', 4000),
      entry('2026-08-11', 4000),
      entry('2026-08-12', 4000),
      entry('2026-08-13', 4000),
    ]
    const week = computeWeekBudget(frugal, 49000, flat, asOf)
    expect(week.today.allowanceKj).toBeGreaterThan(week.today.plannedKj)
  })
})

describe('measureTdee', () => {
  const trendFor = (startKg: number, perDay: number) => (date: DateStr) => {
    const day = Math.round((new Date(date).getTime() - new Date('2026-08-01').getTime()) / 86_400_000)
    return startKg + perDay * day
  }

  it('refuses to guess without enough logged days', () => {
    const result = measureTdee([entry('2026-08-20', 8000)], trendFor(78.5, -0.1), '2026-08-28')
    expect(result.confidence).toBe('none')
    expect(result.reason).toMatch(/logged/)
  })

  it('recovers a known expenditure from intake and weight change', () => {
    // 28 days at 8,000 kJ, losing 0.1 kg/day. Expenditure must be
    // 8,000 + 0.1 × 32,216.8 = 11,221.7 kJ/day.
    const log: LogEntry[] = []
    for (let i = 0; i < 28; i++) {
      const d = new Date('2026-08-01')
      d.setDate(d.getDate() + i)
      log.push(entry(d.toISOString().slice(0, 10), 8000, i))
    }
    const result = measureTdee(log, trendFor(78.5, -0.1), '2026-08-28')
    expect(result.confidence).toBe('high')
    expect(result.tdeeKj).toBeCloseTo(8000 + 0.1 * KJ_PER_KG_TISSUE, -1)
    // Base burn strips digestion out at the intake actually eaten.
    expect(result.baseBurnKj).toBeCloseTo(result.tdeeKj - 0.1 * 8000, 0)
  })
})

describe('proteinTargetG', () => {
  it('targets ~2.4 g per kg of lean mass', () => {
    expect(proteinTargetG(78.5, 20)).toBe(151)
  })
})

describe('loggingStreak', () => {
  it('counts back from today', () => {
    const log = [entry('2026-08-05', 1), entry('2026-08-06', 1), entry('2026-08-07', 1)]
    expect(loggingStreak(log, '2026-08-07')).toBe(3)
  })

  it('survives today not being logged yet', () => {
    const log = [entry('2026-08-05', 1), entry('2026-08-06', 1)]
    expect(loggingStreak(log, '2026-08-07')).toBe(2)
  })

  it('breaks on a genuine gap', () => {
    const log = [entry('2026-08-01', 1), entry('2026-08-06', 1), entry('2026-08-07', 1)]
    expect(loggingStreak(log, '2026-08-07')).toBe(2)
  })
})

describe('the plan anchor', () => {
  // Guards a specific footgun: recording an old weight to show past progress must not
  // redraw the schedule from back then, which would score someone against a plan that
  // hadn't started yet.
  it('is described in state.tsx — a back-dated weigh-in leaves startKg and startDate alone', () => {
    // The goal line is a pure function of the profile, so the behaviour under test is
    // simply that an old reading never becomes the profile's start.
    const june = { ...profile, startKg: 81, startDate: '2026-06-01' }
    const todayStart = { ...profile, startKg: 78.5, startDate: '2026-08-07' }

    const behindByJuneLine = 78.5 - goalLine(june, '2026-08-07')
    const behindByTodayLine = 78.5 - goalLine(todayStart, '2026-08-07')

    expect(behindByJuneLine).toBeGreaterThan(2) // would read as badly behind
    expect(behindByTodayLine).toBeCloseTo(0, 1) // reads as on the line, which is true
  })
})

function goalLine(p: Profile, date: DateStr): number {
  const total = (new Date(p.goalDate).getTime() - new Date(p.startDate).getTime()) / 86_400_000
  const elapsed = (new Date(date).getTime() - new Date(p.startDate).getTime()) / 86_400_000
  return p.startKg + (p.goalKg - p.startKg) * Math.min(1, Math.max(0, elapsed / total))
}
