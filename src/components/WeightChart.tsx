import { useMemo, useState } from 'react'
import type { Profile, WeighIn } from '../lib/types'
import { buildTrend, goalLineKg } from '../lib/trend'
import { addDays, daysBetween, fromDateStr, monthDay, shortDate, today } from '../lib/date'
import { useElementWidth } from './useElementWidth'

interface Props {
  weighIns: WeighIn[]
  profile: Profile
  /** How far back to plot. The goal line always extends to the goal date. */
  days?: number
  asOf?: string
}

const PAD = { top: 14, right: 12, bottom: 24, left: 38 }
const HEIGHT = 190

/**
 * Weight over time: the smoothed trend as the primary line, the raw morning readings as
 * recessive dots behind it, and the schedule to the goal as a dashed reference.
 *
 * The raw dots stay on the chart deliberately. Hiding them would make the app look more
 * confident than the data is; showing them alongside a calm trend line is what teaches
 * you to stop reacting to a bad Tuesday.
 */
export function WeightChart({ weighIns, profile, days = 90, asOf = today() }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(340)
  const [cursor, setCursor] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  const model = useMemo(() => {
    const trendPoints = buildTrend(weighIns, undefined, asOf)
    if (trendPoints.length === 0) return null

    const firstPlotted = trendPoints.length > days ? trendPoints[trendPoints.length - days].date : trendPoints[0].date
    const visible = trendPoints.filter((p) => p.date >= firstPlotted)

    const xStart = visible[0].date

    /*
     * The x-axis runs a little past today, not all the way to the goal date.
     *
     * Stretching to the goal squeezes three weeks of real weigh-ins into the left quarter
     * of the plot and leaves the rest empty — the chart ends up showing mostly future.
     * A short lead keeps the direction of travel visible while the data stays legible.
     * "All" is the view that does show the whole run to the goal.
     */
    const lead = Math.max(6, Math.round(daysBetween(xStart, asOf) * 0.18))
    const leadEnd = addDays(asOf, lead)
    const xEnd =
      days >= 365 && profile.goalDate > asOf
        ? profile.goalDate
        : profile.goalDate > asOf && profile.goalDate < leadEnd
          ? profile.goalDate
          : leadEnd
    const totalDays = Math.max(1, daysBetween(xStart, xEnd))

    // The goal weight is deliberately NOT forced into the y-range. Doing that with 8 kg
    // still to go would compress every real reading into the top sliver of the plot.
    const weights = [
      ...visible.map((p) => p.trend),
      ...visible.filter((p) => p.raw != null).map((p) => p.raw as number),
      goalLineKg(profile, xStart),
      goalLineKg(profile, xEnd),
    ]
    const lo = Math.min(...weights)
    const hi = Math.max(...weights)
    const span = Math.max(1.5, hi - lo)
    const yMin = lo - span * 0.16
    const yMax = hi + span * 0.16

    return { visible, xStart, xEnd, totalDays, yMin, yMax, goalInView: profile.goalKg >= yMin && profile.goalKg <= yMax }
  }, [weighIns, profile, days, asOf])

  if (!model || model.visible.length === 0) {
    return (
      <div className="empty">
        <div className="empty__title">No weigh-ins yet</div>
        Add your first one and the trend line starts building. Aim for most mornings — the app
        smooths out the day-to-day noise for you.
        <p style={{ marginBottom: 0 }}>
          Know roughly what you weighed a few months ago? Back-date it using the date field. Old
          weigh-ins draw the ground you've already covered without moving where your plan starts.
        </p>
      </div>
    )
  }

  const { visible, xStart, totalDays, yMin, yMax } = model
  const plotW = Math.max(60, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom

  const x = (date: string) => PAD.left + (daysBetween(xStart, date) / totalDays) * plotW
  const y = (kg: number) => PAD.top + ((yMax - kg) / (yMax - yMin)) * plotH

  const trendPath = visible.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ')

  const goalStart = { date: xStart > profile.startDate ? xStart : profile.startDate }
  const goalPath = `M${x(goalStart.date).toFixed(1)},${y(goalLineKg(profile, goalStart.date)).toFixed(1)} L${x(model.xEnd).toFixed(1)},${y(goalLineKg(profile, model.xEnd)).toFixed(1)}`

  const yTicks = niceTicks(yMin, yMax, 4)
  const xTicks = dateTicks(xStart, model.xEnd, 4)

  const rawPoints = visible.filter((p) => p.raw != null)
  const hovered = cursor == null ? null : nearest(visible, cursor, x)

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setCursor(e.clientX - rect.left)
  }

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        className="chart"
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`Weight trend from ${shortDate(xStart)} to ${shortDate(model.xEnd)}. Currently ${visible[visible.length - 1].trend.toFixed(1)} kilograms, goal ${profile.goalKg} kilograms.`}
        onPointerMove={handleMove}
        onPointerLeave={() => setCursor(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line className="chart__grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="chart__axis-text" x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end">
              {t.toFixed(t % 1 === 0 ? 0 : 1)}
            </text>
          </g>
        ))}

        {xTicks.map((d) => (
          <text key={d} className="chart__axis-text" x={x(d)} y={HEIGHT - 7} textAnchor="middle">
            {monthDay(d)}
          </text>
        ))}

        {/* Goal weight, drawn only once it's within view. */}
        {model.goalInView && (
          <>
            <line className="chart__target" x1={PAD.left} x2={width - PAD.right} y1={y(profile.goalKg)} y2={y(profile.goalKg)} />
            <text className="chart__axis-text" x={width - PAD.right} y={y(profile.goalKg) - 6} textAnchor="end">
              goal {profile.goalKg} kg
            </text>
          </>
        )}

        {/* Schedule: where the trend needs to be to arrive on time. */}
        <path className="chart__goal" d={goalPath} />

        <path className="chart__trend" d={trendPath} />

        {rawPoints.map((p) => (
          <circle key={p.date} className="chart__raw" cx={x(p.date)} cy={y(p.raw as number)} r={4} />
        ))}

        {hovered && (
          <>
            <line className="chart__crosshair" x1={x(hovered.date)} x2={x(hovered.date)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
            <circle className="chart__cursor" cx={x(hovered.date)} cy={y(hovered.trend)} r={5} />
          </>
        )}
      </svg>

      {hovered && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(x(hovered.date), 62), width - 62),
            top: y(hovered.trend) - 12,
          }}
        >
          <div className="tooltip__date">{shortDate(hovered.date)}</div>
          <div className="tooltip__row">Trend {hovered.trend.toFixed(1)} kg</div>
          {hovered.raw != null && <div className="tooltip__row">Weighed {hovered.raw.toFixed(1)} kg</div>}
          <div className="tooltip__row">Schedule {goalLineKg(profile, hovered.date).toFixed(1)} kg</div>
        </div>
      )}

      {/* Identity is never carried by colour alone. */}
      <div className="legend">
        <span className="legend__item">
          <span className="legend__swatch" style={{ background: 'var(--series-1)' }} /> Trend
        </span>
        <span className="legend__item">
          <span className="legend__swatch legend__swatch--dot" style={{ background: 'var(--series-1-soft)' }} /> Weighed
        </span>
        <span className="legend__item">
          <span className="legend__swatch legend__swatch--dash" /> Schedule
        </span>
        <button className="card__action" style={{ marginLeft: 'auto' }} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Hide numbers' : 'Show numbers'}
        </button>
      </div>

      {showTable && (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Weigh-ins, smoothed trend, and the scheduled weight for each day</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Weighed</th>
                <th scope="col">Trend</th>
                <th scope="col">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {[...visible]
                .reverse()
                .filter((p) => p.raw != null)
                .slice(0, 30)
                .map((p) => (
                  <tr key={p.date}>
                    <td>{shortDate(p.date)}</td>
                    <td>{(p.raw as number).toFixed(1)}</td>
                    <td>{p.trend.toFixed(1)}</td>
                    <td>{goalLineKg(profile, p.date).toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function nearest<T extends { date: string }>(points: T[], px: number, x: (d: string) => number): T | null {
  let best: T | null = null
  let bestDist = Infinity
  for (const p of points) {
    const dist = Math.abs(x(p.date) - px)
    if (dist < bestDist) {
      bestDist = dist
      best = p
    }
  }
  // Only snap when the pointer is genuinely near the series.
  return bestDist < 40 ? best : null
}

/** Round tick values a person would actually choose: 0.5, 1, 2, 5 kg apart. */
function niceTicks(min: number, max: number, count: number): number[] {
  const rough = (max - min) / count
  const steps = [0.2, 0.5, 1, 2, 2.5, 5, 10]
  const step = steps.find((s) => s >= rough) ?? 10
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

function dateTicks(start: string, end: string, count: number): string[] {
  const span = daysBetween(start, end)
  if (span <= 0) return [start]
  const out: string[] = []
  for (let i = 0; i <= count; i++) {
    const d = fromDateStr(start)
    d.setDate(d.getDate() + Math.round((span * i) / count))
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return out
}
