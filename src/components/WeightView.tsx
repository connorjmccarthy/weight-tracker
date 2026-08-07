import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { usePlan } from '../usePlan'
import { WeightChart } from './WeightChart'
import { budgetCorrectionKj, buildTrend, latestTrend, latestWeighIn } from '../lib/trend'
import { addDays, daysBetween, longDate, shortDate, today as todayStr } from '../lib/date'
import { formatEnergy, formatKg, formatSignedKg, humanDuration } from '../lib/format'
import { Sheet } from './Sheet'

const STATUS_COPY: Record<string, { pill: string; tone: string; icon: string }> = {
  ahead: { pill: 'Ahead of schedule', tone: 'pill--good', icon: '✓' },
  'on-track': { pill: 'On track', tone: 'pill--good', icon: '✓' },
  'slightly-behind': { pill: 'A little behind', tone: 'pill--warning', icon: '•' },
  behind: { pill: 'Behind schedule', tone: 'pill--serious', icon: '!' },
  gaining: { pill: 'Trending up', tone: 'pill--critical', icon: '!' },
  'no-data': { pill: 'Not enough data yet', tone: '', icon: '·' },
}

export function WeightView() {
  const { state, profile, setWeighIn, removeWeighIn } = useStore()
  const plan = usePlan()
  const [adding, setAdding] = useState(false)
  const [range, setRange] = useState(90)

  const points = useMemo(() => buildTrend(state.weighIns, undefined, todayStr()), [state.weighIns])
  const trend = latestTrend(points)
  const last = latestWeighIn(state.weighIns)
  const status = STATUS_COPY[plan.projection.status] ?? STATUS_COPY['no-data']
  const correctionKj = budgetCorrectionKj(plan.currentKg, profile, todayStr(), plan.projection.kgPerWeek)

  const sevenDayChange = useMemo(() => {
    if (points.length < 8) return null
    const now = points[points.length - 1].trend
    const weekAgoDate = addDays(points[points.length - 1].date, -7)
    const prev = points.find((p) => p.date === weekAgoDate)
    return prev ? now - prev.trend : null
  }, [points])

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title">Weight</h1>
          <div className="topbar__sub">
            {trend != null ? `Trend ${formatKg(trend)} · goal ${formatKg(profile.goalKg, 0)}` : 'Add your first weigh-in'}
          </div>
        </div>
        <button className="btn btn--primary" style={{ minHeight: 38, padding: '0 14px' }} onClick={() => setAdding(true)}>
          + Weigh in
        </button>
      </header>

      <section className="card">
        <div className="hero">
          <div>
            <span className="hero__value">{trend != null ? trend.toFixed(1) : '—'}</span>
            <span className="hero__unit">kg trend</span>
            <div className="hero__label">
              {last ? `Last weighed ${last.kg.toFixed(1)} kg on ${shortDate(last.date)}` : 'No weigh-ins yet'}
            </div>
          </div>
          <div className="hero__aside">
            <span className={`pill ${status.tone}`}>
              <span aria-hidden="true">{status.icon}</span> {status.pill}
            </span>
          </div>
        </div>

        <div className="stats" style={{ marginTop: 16 }}>
          <div className="stat">
            <div className="stat__label">To go</div>
            <div className="stat__value">{trend != null ? formatKg(Math.max(0, trend - profile.goalKg)) : '—'}</div>
            <div className="stat__sub">by {longDate(profile.goalDate)}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Last 7 days</div>
            <div className="stat__value">{sevenDayChange != null ? formatSignedKg(sevenDayChange) : '—'}</div>
            <div className="stat__sub">trend, not scale</div>
          </div>
          <div className="stat">
            <div className="stat__label">Current rate</div>
            <div className="stat__value">
              {plan.projection.confidence === 'none'
                ? '—'
                : `${plan.projection.kgPerWeek > 0 ? '+' : '−'}${Math.abs(plan.projection.kgPerWeek).toFixed(2)}`}
            </div>
            <div className="stat__sub">kg/week · need −{plan.requiredRateKgPerWeek.toFixed(2)}</div>
          </div>
        </div>

        {plan.projection.date && plan.projection.confidence !== 'none' && (
          <div className="note">
            <span className="note__icon" aria-hidden="true">
              →
            </span>
            <span>
              At this rate you reach <strong>{formatKg(profile.goalKg, 0)}</strong> around{' '}
              <strong>{longDate(plan.projection.date)}</strong>
              {plan.projection.daysAway != null ? ` — ${humanDuration(plan.projection.daysAway)} away` : ''}.{' '}
              {plan.projection.date <= profile.goalDate ? (
                'That beats your deadline.'
              ) : (
                <>
                  That's {humanDuration(daysBetween(profile.goalDate, plan.projection.date))} past your deadline of{' '}
                  {longDate(profile.goalDate)}. Closing it means about{' '}
                  <strong>
                    {formatEnergy(Math.abs(correctionKj), profile.units)} a day
                  </strong>{' '}
                  less food — or the same again in extra walking, which is the easier half of the trade.
                </>
              )}
            </span>
          </div>
        )}

        {plan.projection.status === 'no-data' && state.weighIns.length > 0 && (
          <div className="note">
            <span className="note__icon" aria-hidden="true">
              ·
            </span>
            <span>
              Needs about a fortnight of weigh-ins before a rate means anything. Day-to-day weight swings 1–2 kg
              on water alone, so early numbers are noise.
            </span>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Trend</h2>
          <div className="chips">
            {[30, 90, 365].map((d) => (
              <button key={d} className="chip" aria-pressed={range === d} onClick={() => setRange(d)} style={{ minHeight: 30 }}>
                {d === 365 ? 'All' : `${d}d`}
              </button>
            ))}
          </div>
        </div>
        <WeightChart weighIns={state.weighIns} profile={profile} days={range} />
      </section>

      {state.weighIns.length > 0 && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">History</h2>
          </div>
          {[...state.weighIns]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)
            .map((w) => (
              <div className="entry" key={w.date}>
                <div className="entry__body">
                  <div className="entry__name">{shortDate(w.date)}</div>
                </div>
                <span className="entry__kj">{w.kg.toFixed(1)} kg</span>
                <button className="entry__del" onClick={() => removeWeighIn(w.date)} aria-label={`Remove weigh-in for ${shortDate(w.date)}`}>
                  ✕
                </button>
              </div>
            ))}
        </section>
      )}

      {adding && <WeighInSheet onClose={() => setAdding(false)} onSave={setWeighIn} defaultKg={trend ?? profile.startKg} />}
    </>
  )
}

function WeighInSheet({
  onClose,
  onSave,
  defaultKg,
}: {
  onClose: () => void
  onSave: (date: string, kg: number) => void
  defaultKg: number
}) {
  const [kg, setKg] = useState(defaultKg.toFixed(1))
  const [date, setDate] = useState(todayStr())
  const value = Number(kg)

  return (
    <Sheet title="Weigh in" onClose={onClose}>
      <label className="field">
        <span className="field__label">Weight (kg)</span>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          style={{ fontSize: 28, fontWeight: 650, height: 62, textAlign: 'center' }}
        />
      </label>

      <label className="field">
        <span className="field__label">Date</span>
        <input className="input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
      </label>

      <div className="note">
        <span className="note__icon" aria-hidden="true">
          ·
        </span>
        <span>
          Weigh first thing, after the toilet, before eating or drinking, in the same clothes. Same conditions
          every time matters far more than the number itself — the app cares about the trend, not any one
          morning.
        </span>
      </div>

      <button
        className="btn btn--primary btn--block"
        style={{ marginTop: 16 }}
        disabled={!Number.isFinite(value) || value <= 20 || value > 400}
        onClick={() => {
          onSave(date, Math.round(value * 10) / 10)
          onClose()
        }}
      >
        Save
      </button>
    </Sheet>
  )
}
