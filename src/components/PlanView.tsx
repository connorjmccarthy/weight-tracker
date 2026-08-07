import { useRef, useState } from 'react'
import { useStore } from '../state'
import { usePlan } from '../usePlan'
import { ACTIVITY_LEVELS, activityLabel, kjToKcal, proteinFloorG, proteinTargetG, TEF_RATE, walkKj } from '../lib/energy'
import { exportCsv, exportJson, download, importJson } from '../lib/storage'
import { longDate } from '../lib/date'
import { formatEnergy, formatKg, formatKj, unitLabel } from '../lib/format'
import type { Weekday } from '../lib/types'

const DAY_LABELS: [Weekday, string][] = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [0, 'Sun'],
]

const FEASIBILITY: Record<string, { tone: string; label: string; icon: string }> = {
  comfortable: { tone: 'pill--good', label: 'Comfortable pace', icon: '✓' },
  'on-plan': { tone: 'pill--good', label: 'Sensible pace', icon: '✓' },
  aggressive: { tone: 'pill--warning', label: 'Aggressive', icon: '!' },
  'not-possible': { tone: 'pill--critical', label: 'Not realistic', icon: '!' },
}

export function PlanView() {
  const { state, profile, setProfile, replaceAll, resetAll } = useStore()
  const plan = usePlan()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const feas = FEASIBILITY[plan.feasibility]

  // Logged intake and observed weight change have to agree. When the measured
  // expenditure comes out far below what the equation predicts, the logging is the
  // thing that's wrong — not the metabolism.
  const underLogging =
    plan.measured.confidence !== 'none' &&
    plan.measured.tdeeKj > 0 &&
    plan.measured.tdeeKj < plan.bmrKj * profile.activityFactor * 0.82

  const dayWeightTotal = DAY_LABELS.reduce((sum, [d]) => sum + (profile.dayWeights[d] ?? 1), 0)

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title">Plan</h1>
          <div className="topbar__sub">
            {formatEnergy(plan.dailyTargetKj, profile.units)} a day · {formatKg(profile.goalKg, 0)} by{' '}
            {longDate(profile.goalDate)}
          </div>
        </div>
      </header>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Your targets</h2>
          <span className={`pill ${feas.tone}`}>
            <span aria-hidden="true">{feas.icon}</span> {feas.label}
          </span>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat__label">Every day</div>
            <div className="stat__value">{formatKj(plan.dailyTargetKj, profile.units)}</div>
            <div className="stat__sub">{unitLabel(profile.units)} average</div>
          </div>
          <div className="stat">
            <div className="stat__label">Every week</div>
            <div className="stat__value">{formatKj(plan.weeklyTargetKj, profile.units)}</div>
            <div className="stat__sub">the number that counts</div>
          </div>
          <div className="stat">
            <div className="stat__label">Protein</div>
            <div className="stat__value">{profile.proteinTargetG} g</div>
            <div className="stat__sub">a day, to keep muscle</div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">How the daily target is worked out</caption>
            <tbody>
              <tr>
                <td>Resting metabolism (Mifflin-St Jeor)</td>
                <td>
                  {formatKj(plan.bmrKj, profile.units)} {unitLabel(profile.units)}
                </td>
              </tr>
              <tr>
                <td>
                  Burnt per day — {plan.tdeeSource === 'measured' ? 'measured from your data' : activityLabel(profile.activityFactor)}
                </td>
                <td>
                  {formatKj(plan.tdeeKj, profile.units)} {unitLabel(profile.units)}
                </td>
              </tr>
              <tr>
                <td>Deficit needed for {plan.requiredRateKgPerWeek.toFixed(2)} kg/week</td>
                <td>
                  −{formatKj(plan.requiredDailyDeficitKj, profile.units)} {unitLabel(profile.units)}
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Eat</strong>
                </td>
                <td>
                  <strong>
                    {formatKj(plan.dailyTargetKj, profile.units)} {unitLabel(profile.units)}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {plan.floorApplied && (
          <div className="note note--critical">
            <span className="note__icon" aria-hidden="true">
              ⚠
            </span>
            <span>
              Hitting {formatKg(profile.goalKg, 0)} by {longDate(profile.goalDate)} would need{' '}
              {formatEnergy(plan.rawDailyTargetKj, profile.units)} a day, which is below the floor you've set.
              The target is being held at {formatEnergy(profile.floorKj, profile.units)}.
              {plan.achievableGoalDate && <> At that intake you'd get there around <strong>{longDate(plan.achievableGoalDate)}</strong> instead.</>}{' '}
              The better fix is more walking, not less food.
            </span>
          </div>
        )}

        {!plan.floorApplied && plan.feasibility === 'aggressive' && (
          <div className="note note--warning">
            <span className="note__icon" aria-hidden="true">
              !
            </span>
            <span>
              This is a{' '}
              <strong>{Math.round(((plan.tdeeKj - plan.dailyTargetKj) / plan.tdeeKj) * 100)}% deficit</strong> —
              steeper than the 20–25% that's normally recommended. It works, but there's no slack in it. Adding
              walking raises what you burn, which buys you food without moving the date.
            </span>
          </div>
        )}

        {plan.tdeeSource === 'measured' && (
          <div className="note">
            <span className="note__icon" aria-hidden="true">
              ✓
            </span>
            <span>
              This target is now based on <strong>your actual data</strong> — {plan.measured.daysLogged} logged days
              against {formatKg(Math.abs(plan.measured.weightChangeKg))} of trend movement — rather than a
              textbook equation. That's a far better estimate of what you personally burn.
            </span>
          </div>
        )}

        {underLogging && (
          <div className="note note--warning">
            <span className="note__icon" aria-hidden="true">
              ⚠
            </span>
            <span>
              <strong>Your log and your scale disagree.</strong> What you've logged, set against how your weight
              has actually moved, implies you burn only{' '}
              {formatEnergy(plan.measured.tdeeKj, profile.units)} a day — well under what someone your size
              plausibly burns. The usual cause isn't a slow metabolism, it's food that never made it into the
              log: lunches, oil and butter in cooking, sides, drinks, second helpings. Worth a week of logging
              everything, including the things you'd rather not.
            </span>
          </div>
        )}
      </section>

      {/*
        The escape hatch, made concrete. When the goal date needs more deficit than is safe
        to cut, the only other lever is the denominator — and "walk more" is uselessly vague
        without a number attached to it.
      */}
      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Walking buys food back</h2>
        </div>
        <p className="field__hint" style={{ marginTop: 0 }}>
          Extra walking on top of what you already do, and what it lets you eat. Nothing here is added to your
          daily budget automatically — this is a choice about the plan, not a reward for a workout.
        </p>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Extra walking per week against the daily target it supports</caption>
            <thead>
              <tr>
                <th scope="col">Extra walking</th>
                <th scope="col">Burnt</th>
                <th scope="col">You could eat</th>
              </tr>
            </thead>
            <tbody>
              {[0, 10, 18, 25].map((extraKm) => {
                const extraPerDay = walkKj(extraKm, plan.currentKg) / 7
                // A kilojoule of extra burn buys slightly more than a kilojoule of food,
                // because eating it also costs something to digest.
                const target = Math.round(plan.rawDailyTargetKj + extraPerDay / (1 - TEF_RATE))
                const held = Math.max(target, profile.floorKj)
                return (
                  <tr key={extraKm}>
                    <td>{extraKm === 0 ? 'What you do now' : `+${extraKm} km/week`}</td>
                    <td>{extraKm === 0 ? '–' : `+${formatKj(extraPerDay, profile.units)}`}</td>
                    <td style={{ fontWeight: target >= profile.floorKj ? 600 : 400 }}>
                      {formatKj(held, profile.units)}
                      {target < profile.floorKj ? '*' : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="field__hint">
          {plan.floorApplied
            ? '* Held at your floor — below this, the date has to move rather than the food. '
            : ''}
          25 km a week is roughly an extra 3.5 km a day, or about 35 minutes of walking. That's the whole
          difference between a diet with no room in it and one you can live with.
        </p>
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Where the week's energy goes</h2>
        </div>
        <p className="field__hint" style={{ marginTop: 0 }}>
          Some days are bigger than others, and pretending otherwise is what makes people quit. Give your
          eating-out days a larger share — the week still adds up to the same total.
        </p>
        {DAY_LABELS.map(([d, label]) => {
          const weight = profile.dayWeights[d] ?? 1
          const kj = Math.round((plan.weeklyTargetKj * weight) / dayWeightTotal)
          return (
            <div className="row-between" key={d}>
              <span style={{ width: 46, fontWeight: 600 }}>{label}</span>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={weight}
                aria-label={`${label} share of the week's energy`}
                onChange={(e) => setProfile({ dayWeights: { ...profile.dayWeights, [d]: Number(e.target.value) } })}
                style={{ flex: 1, accentColor: 'var(--series-1)' }}
              />
              <span className="tnum secondary" style={{ width: 78, textAlign: 'right', fontSize: 14 }}>
                {formatKj(kj, profile.units)}
              </span>
            </div>
          )
        })}
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">About you</h2>
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">Age</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={profile.age}
              onChange={(e) => setProfile({ age: Number(e.target.value) || profile.age })}
            />
          </label>
          <label className="field">
            <span className="field__label">Height (cm)</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={profile.heightCm}
              onChange={(e) => setProfile({ heightCm: Number(e.target.value) || profile.heightCm })}
            />
          </label>
          <label className="field">
            <span className="field__label">Goal weight (kg)</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={profile.goalKg}
              onChange={(e) => setProfile({ goalKg: Number(e.target.value) || profile.goalKg })}
            />
          </label>
          <label className="field">
            <span className="field__label">Goal date</span>
            <input
              className="input"
              type="date"
              value={profile.goalDate}
              onChange={(e) => setProfile({ goalDate: e.target.value })}
            />
          </label>
        </div>

        <div className="field">
          <span className="field__label">How much you move</span>
          <div className="chips">
            {ACTIVITY_LEVELS.map((level) => (
              <button
                key={level.factor}
                className="chip"
                aria-pressed={Math.abs(profile.activityFactor - level.factor) < 0.02}
                onClick={() => setProfile({ activityFactor: level.factor })}
              >
                {level.label}
              </button>
            ))}
          </div>
          <p className="field__hint">
            {ACTIVITY_LEVELS.find((l) => Math.abs(l.factor - profile.activityFactor) < 0.02)?.detail ??
              'Custom setting'}
            . Nearly everyone picks one level too high. Exercise is never added back to your budget — it's already
            counted here.
          </p>
        </div>

        <label className="field">
          <span className="field__label">Never go below ({unitLabel(profile.units)} per day)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            step="100"
            value={Math.round(profile.units === 'kcal' ? kjToKcal(profile.floorKj) : profile.floorKj)}
            onChange={(e) => {
              const v = Number(e.target.value) || 0
              setProfile({ floorKj: Math.round(profile.units === 'kcal' ? v * 4.184 : v) })
            }}
          />
          <p className="field__hint">
            A hard floor, whatever the goal date demands. If the scale stalls at this intake, add walking rather
            than cutting further.
          </p>
        </label>

        <label className="field">
          <span className="field__label">Protein target (g per day)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={profile.proteinTargetG}
            onChange={(e) => setProfile({ proteinTargetG: Number(e.target.value) || 0 })}
          />
          <p className="field__hint">
            Suggested {proteinTargetG(plan.currentKg)} g for your size, and never below{' '}
            {proteinFloorG(plan.currentKg)} g. Protein plus keeping your lifting weights up is what decides
            whether you lose fat or muscle. On a day where you can't hit both numbers, hit this one and miss the
            kilojoules — not the other way round.
          </p>
        </label>

        <button
          className="switch"
          aria-pressed={profile.useAdaptiveTdee}
          onClick={() => setProfile({ useAdaptiveTdee: !profile.useAdaptiveTdee })}
        >
          <span>
            <span style={{ fontWeight: 550, display: 'block' }}>Learn from my data</span>
            <span className="field__hint" style={{ margin: 0 }}>
              After about four weeks of logging, work out what you really burn from your own intake and weight
              change instead of the equation.
            </span>
          </span>
          <span className="switch__track">
            <span className="switch__thumb" />
          </span>
        </button>

        <button
          className="switch"
          aria-pressed={profile.units === 'kcal'}
          onClick={() => setProfile({ units: profile.units === 'kcal' ? 'kj' : 'kcal' })}
        >
          <span>
            <span style={{ fontWeight: 550, display: 'block' }}>Show calories instead of kilojoules</span>
            <span className="field__hint" style={{ margin: 0 }}>
              Australian labels are in kJ, so kJ is the default.
            </span>
          </span>
          <span className="switch__track">
            <span className="switch__thumb" />
          </span>
        </button>
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Your data</h2>
        </div>
        <p className="field__hint" style={{ marginTop: 0 }}>
          Everything lives on this device only — no account, no server, nothing leaves your phone. That also
          means clearing your browser data would wipe it, so back up occasionally.
        </p>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => download(`weight-tracker-${new Date().toISOString().slice(0, 10)}.json`, exportJson(state))}
          >
            ⬇ Backup
          </button>
          <button
            className="btn"
            onClick={() => download(`food-log-${new Date().toISOString().slice(0, 10)}.csv`, exportCsv(state), 'text/csv')}
          >
            ⬇ CSV
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ Restore
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              replaceAll(importJson(await file.text()))
              setMessage('Backup restored.')
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Could not read that file.')
            }
            e.target.value = ''
          }}
        />
        {message && (
          <div className="note">
            <span className="note__icon" aria-hidden="true">
              ·
            </span>
            <span>{message}</span>
          </div>
        )}

        <button
          className="btn btn--ghost btn--danger btn--block"
          style={{ marginTop: 10 }}
          onClick={() => {
            if (confirm('Delete every logged meal, weigh-in and custom food? This cannot be undone.')) resetAll()
          }}
        >
          Erase everything
        </button>
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Worth knowing</h2>
        </div>
        <p className="field__hint" style={{ marginTop: 0 }}>
          The kilojoule figures here are population averages and published nutrition panels — real portions vary,
          and self-reported intake is under-counted by 20–30% in almost everyone. The app's job is to make that
          error <em>consistent</em>, so the trend it shows is honest even when the absolute numbers aren't
          perfect.
        </p>
        <p className="field__hint">
          This is general nutrition information, not medical advice. Talk to a GP or an Accredited Practising
          Dietitian before a steep deficit if you take any medication, have a thyroid, cardiac, kidney or
          blood-sugar condition, or any history of disordered eating — daily weighing and food logging are not
          safe for everyone.
        </p>
      </section>
    </>
  )
}
