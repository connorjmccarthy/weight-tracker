import { useMemo, useState } from 'react'
import type { DateStr, DayTemplate, Food, Meal } from '../lib/types'
import { MEALS } from '../lib/types'
import { useStore } from '../state'
import { computeWeekBudget, loggingStreak, PORTION_PRESETS } from '../lib/energy'
import { addDays, friendlyDate, today as todayStr } from '../lib/date'
import { formatKj, formatEnergy, unitLabel } from '../lib/format'
import { usePlan } from '../usePlan'
import { WeekChart } from './WeekChart'
import { LogFoodSheet } from './LogFoodSheet'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

export function TodayView() {
  const store = useStore()
  const { state, profile, foodById, recentFoodIds } = store
  const plan = usePlan()
  const [date, setDate] = useState<DateStr>(todayStr())
  const [sheet, setSheet] = useState<{ meal?: Meal; food?: Food } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const week = useMemo(
    () => computeWeekBudget(state.log, plan.weeklyTargetKj, profile.dayWeights, date),
    [state.log, plan.weeklyTargetKj, profile.dayWeights, date],
  )

  const dayBudget = week.days.find((d) => d.date === date) ?? week.today
  const consumed = dayBudget.consumedKj
  const allowance = dayBudget.allowanceKj
  const left = allowance - consumed
  const over = left < 0

  const entries = useMemo(
    () => state.log.filter((e) => e.date === date).sort((a, b) => a.at - b.at),
    [state.log, date],
  )

  const streak = useMemo(() => loggingStreak(state.log, todayStr()), [state.log])

  const suggestedTemplates = useMemo(() => {
    const dow = new Date(date + 'T12:00:00').getDay()
    const matching = state.templates.filter((t) => t.suggestOn?.includes(dow))
    return matching.length ? matching : state.templates.slice(0, 3)
  }, [state.templates, date])

  const quickFoods = useMemo(() => {
    const ids = [...state.favouriteIds, ...recentFoodIds(16).filter((id) => !state.favouriteIds.includes(id))]
    return ids.map(foodById).filter((f): f is Food => !!f && !f.archived).slice(0, 12)
  }, [state.favouriteIds, recentFoodIds, foodById])

  const applyTemplate = (t: DayTemplate) => {
    const items = t.items
      .map((it) => ({ food: foodById(it.foodId), servings: it.servings, meal: it.meal }))
      .filter((it): it is { food: Food; servings: number; meal: Meal } => !!it.food)
    if (items.length) store.addEntries(items, date)
  }

  const meterPct = allowance > 0 ? Math.min(100, (consumed / allowance) * 100) : 0
  const meterClass = over ? 'meter__fill--over' : meterPct > 85 ? 'meter__fill--warning' : ''

  const proteinToday = entries.reduce((sum, e) => sum + (e.protein ?? 0) * e.servings, 0)

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title">{friendlyDate(date)}</h1>
          <div className="topbar__sub">
            {formatEnergy(week.remainingKj, profile.units)} left this week
            {streak > 1 ? ` · ${streak}-day streak` : ''}
          </div>
        </div>
        <div className="btn-row" style={{ flexWrap: 'nowrap' }}>
          <button className="chip" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            ‹
          </button>
          <button
            className="chip"
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= todayStr()}
            style={{ opacity: date >= todayStr() ? 0.35 : 1 }}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </header>

      {/* Hero: the one number this screen is for. */}
      <section className={`card ${over ? 'hero--over' : ''}`} aria-labelledby="today-hero">
        <div className="hero">
          <div>
            <span className="hero__value">{formatKj(Math.abs(left), profile.units)}</span>
            <span className="hero__unit">{unitLabel(profile.units)}</span>
            <div className="hero__label" id="today-hero">
              {over ? 'over today’s allowance' : 'left today'}
            </div>
          </div>
          <div className="hero__aside">
            <div>
              {formatKj(consumed, profile.units)} eaten
              <br />
              of {formatKj(allowance, profile.units)}
            </div>
          </div>
        </div>

        <div className="meter">
          <div
            className="meter__track"
            role="meter"
            aria-valuenow={Math.round(consumed)}
            aria-valuemin={0}
            aria-valuemax={Math.round(allowance)}
            aria-label="Energy used today"
          >
            <div className={`meter__fill ${meterClass}`} style={{ width: `${meterPct}%` }} />
          </div>
          <div className="meter__legend">
            <span>{Math.round(meterPct)}% of today</span>
            <span>{profile.proteinTargetG > 0 ? `${Math.round(proteinToday)} / ${profile.proteinTargetG} g protein` : ''}</span>
          </div>
        </div>

        {over && (
          <div className="note note--warning">
            <span className="note__icon" aria-hidden="true">
              ⚠
            </span>
            <span>
              Over by <strong>{formatEnergy(-left, profile.units)}</strong>. Nothing is ruined — the rest of the
              week just absorbs it. Tomorrow's allowance has already adjusted.
            </span>
          </div>
        )}
      </section>

      {plan.needsWeighIns && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Start here</h2>
          </div>
          <p className="field__hint" style={{ marginTop: 0 }}>
            Two things make everything else work, and both take a fortnight before they mean anything:
          </p>
          <ol className="field__hint" style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>
              <strong>Weigh in most mornings.</strong> Same time, after the toilet, before food. Any single
              reading is noise; the trend is the signal.
            </li>
            <li>
              <strong>Log everything for the first week — including the things you'd rather not.</strong> The
              target above is currently a textbook estimate. Once there's real data the app replaces it with
              what you actually burn, which is worth far more than any equation.
            </li>
          </ol>
        </section>
      )}

      {/* Quick add: the whole reason this app is faster than the alternative. */}
      <section className="card" aria-labelledby="quick-add">
        <div className="card__head">
          <h2 className="card__title" id="quick-add">
            One tap
          </h2>
          <button className="card__action" onClick={() => setSheet({})}>
            Search all foods
          </button>
        </div>

        {suggestedTemplates.length > 0 && (
          <div className="tiles" style={{ marginBottom: 10 }}>
            {suggestedTemplates.map((t) => (
              <button key={t.id} className="tile tile--template" onClick={() => applyTemplate(t)}>
                <span className="tile__name">
                  {t.emoji ? `${t.emoji} ` : ''}
                  {t.name}
                </span>
                <span className="tile__kj">
                  {formatKj(
                    t.items.reduce((sum, it) => sum + (foodById(it.foodId)?.kj ?? 0) * it.servings, 0),
                    profile.units,
                  )}{' '}
                  {unitLabel(profile.units)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="tiles">
          {quickFoods.map((f) => (
            <button key={f.id} className="tile" onClick={() => setSheet({ food: f })}>
              <span className="tile__name">{f.name}</span>
              <span className="tile__kj">
                {formatKj(f.kj, profile.units)} {unitLabel(profile.units)}
              </span>
            </button>
          ))}
        </div>

        {entries.length === 0 && (
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="btn btn--ghost"
              onClick={() => {
                const copied = store.copyDay(addDays(date, -1), date)
                if (copied === 0) setSheet({})
              }}
            >
              ⟲ Copy yesterday
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                const copied = store.copyDay(addDays(date, -7), date)
                if (copied === 0) setSheet({})
              }}
            >
              ⟲ Copy last {friendlyDate(addDays(date, -7)).split(' ')[0]}
            </button>
          </div>
        )}
      </section>

      {/* The day's log. */}
      <section className="card" aria-labelledby="day-log">
        <div className="card__head">
          <h2 className="card__title" id="day-log">
            Logged
          </h2>
          <button className="card__action" onClick={() => setSheet({})}>
            + Add
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="empty">
            <div className="empty__title">Nothing logged yet</div>
            Tap a tile above, or search. Logging roughly beats not logging at all.
          </div>
        ) : (
          MEALS.filter((m) => entries.some((e) => e.meal === m)).map((meal) => {
            const group = entries.filter((e) => e.meal === meal)
            const total = group.reduce((sum, e) => sum + e.kjPerServing * e.servings, 0)
            return (
              <div className="meal-group" key={meal}>
                <div className="meal-group__head">
                  <span>{MEAL_LABELS[meal]}</span>
                  <span style={{ textTransform: 'none' }}>
                    {formatKj(total, profile.units)} {unitLabel(profile.units)}
                  </span>
                </div>
                {group.map((e) => (
                  <div key={e.id}>
                    <div className="entry">
                      <button
                        className="entry__body"
                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                        aria-expanded={expanded === e.id}
                      >
                        <div className="entry__name">{e.name}</div>
                        <div className="entry__meta">
                          {portionWord(e.servings)} · {formatKj(e.kjPerServing, profile.units)}{' '}
                          {unitLabel(profile.units)} each
                        </div>
                      </button>
                      <span className="entry__kj">{formatKj(e.kjPerServing * e.servings, profile.units)}</span>
                      <button className="entry__del" onClick={() => store.removeEntry(e.id)} aria-label={`Remove ${e.name}`}>
                        ✕
                      </button>
                    </div>

                    {/* Fixing a portion is one tap and no keyboard. In MyFitnessPal it is
                        six taps and a number pad, which is why nobody ever corrects anything. */}
                    {expanded === e.id && (
                      <div className="chips" style={{ padding: '2px 2px 12px' }}>
                        <button
                          className="chip"
                          onClick={() => store.updateEntry(e.id, { servings: Math.max(0.25, round(e.servings * 0.75)) })}
                        >
                          − Smaller
                        </button>
                        <button className="chip" aria-pressed={e.servings === 1} onClick={() => store.updateEntry(e.id, { servings: 1 })}>
                          As usual
                        </button>
                        <button className="chip" onClick={() => store.updateEntry(e.id, { servings: round(e.servings * 1.33) })}>
                          + Bigger
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })
        )}
      </section>

      <section className="card" aria-labelledby="week-chart">
        <div className="card__head">
          <h2 className="card__title" id="week-chart">
            This week
          </h2>
          <span className="pill">
            {formatKj(week.consumedKj, profile.units)} / {formatKj(week.weeklyTargetKj, profile.units)}
          </span>
        </div>
        <WeekChart week={week} units={profile.units} />
        <p className="field__hint" style={{ marginTop: 10 }}>
          Your budget is weekly, not daily. Going big on a Wednesday just makes Thursday to Sunday a little
          smaller — the week is what counts.
        </p>

        {week.unloggedPastDates.length > 0 && (
          <div className="note">
            <span className="note__icon" aria-hidden="true">
              ·
            </span>
            <span>
              Nothing logged on{' '}
              <strong>{week.unloggedPastDates.map((d) => friendlyDate(d)).join(', ')}</strong>. Those days are
              counted as if you ate to plan, so skipping the log never quietly buys you a bigger week. Tap back
              and fill them in if you can remember.
            </span>
          </div>
        )}
      </section>

      {sheet && (
        <LogFoodSheet date={date} meal={sheet.meal} preselected={sheet.food} onClose={() => setSheet(null)} />
      )}
    </>
  )
}

function round(n: number): number {
  return Math.round(n * 20) / 20
}

function portionWord(servings: number): string {
  const preset = PORTION_PRESETS.find((p) => Math.abs(p.mult - servings) < 0.001)
  if (preset) return preset.label
  return `×${servings}`
}
