import { useMemo, useState } from 'react'
import type { WeekBudget } from '../lib/energy'
import type { Profile } from '../lib/types'
import { dayShort, shortDate } from '../lib/date'
import { formatKj, unitLabel } from '../lib/format'
import { useElementWidth } from './useElementWidth'

interface Props {
  week: WeekBudget
  units: Profile['units']
}

const PAD = { top: 12, right: 4, bottom: 30, left: 4 }
const HEIGHT = 150

/**
 * The week at a glance: what each day cost, against what that day was allowed.
 *
 * One series, one colour. The only second colour is the slice of a bar that went past its
 * allowance — that is a *status*, not another category, so it carries a status hue and is
 * named in the legend rather than left to be inferred.
 */
export function WeekChart({ week, units }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(340)
  const [showTable, setShowTable] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  const yMax = useMemo(() => {
    const peak = Math.max(...week.days.map((d) => Math.max(d.consumedKj, d.allowanceKj)), 1)
    return peak * 1.12
  }, [week])

  const plotW = Math.max(60, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const slot = plotW / 7
  const barW = Math.min(30, slot * 0.56)

  const yOf = (kj: number) => PAD.top + plotH - (kj / yMax) * plotH
  const anyOver = week.days.some((d) => d.consumedKj > d.allowanceKj && d.allowanceKj > 0)

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        className="chart"
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`Energy logged each day this week against each day's allowance. ${formatKj(week.consumedKj, units)} of ${formatKj(week.weeklyTargetKj, units)} ${unitLabel(units)} used.`}
        onPointerLeave={() => setHover(null)}
      >
        <line className="chart__grid" x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} />

        {week.days.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2
          const over = Math.max(0, d.consumedKj - d.allowanceKj)
          const within = Math.min(d.consumedKj, d.allowanceKj)
          const baseY = PAD.top + plotH

          return (
            <g key={d.date} onPointerEnter={() => setHover(i)}>
              {/* Hit target spans the whole slot, not just the bar. */}
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH + PAD.bottom} fill="transparent" />

              {within > 0 && (
                <rect
                  className="chart__bar"
                  x={cx - barW / 2}
                  y={yOf(within)}
                  width={barW}
                  height={Math.max(2, baseY - yOf(within))}
                  rx={4}
                  opacity={d.isToday ? 1 : 0.85}
                />
              )}

              {over > 0 && (
                /* 2px surface gap separates the segments — never a border stroke. */
                <rect
                  className="chart__bar--over"
                  x={cx - barW / 2}
                  y={yOf(d.consumedKj)}
                  width={barW}
                  height={Math.max(2, yOf(within) - yOf(d.consumedKj) - 2)}
                  rx={4}
                />
              )}

              {d.allowanceKj > 0 && (
                <line
                  className="chart__allowance"
                  x1={cx - barW / 2 - 3}
                  x2={cx + barW / 2 + 3}
                  y1={yOf(d.allowanceKj)}
                  y2={yOf(d.allowanceKj)}
                />
              )}

              <text
                className="chart__axis-text"
                x={cx}
                y={HEIGHT - 15}
                textAnchor="middle"
                fill={d.isToday ? 'var(--series-1)' : undefined}
                fontWeight={d.isToday ? 700 : undefined}
              >
                {dayShort(d.weekday)}
              </text>
              <text className="chart__axis-text" x={cx} y={HEIGHT - 3} textAnchor="middle">
                {d.consumedKj > 0 ? Math.round(d.consumedKj / 1000) + 'k' : '–'}
              </text>
            </g>
          )
        })}
      </svg>

      {hover != null && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(PAD.left + slot * hover + slot / 2, 68), width - 68),
            top: yOf(Math.max(week.days[hover].consumedKj, week.days[hover].allowanceKj)) - 8,
          }}
        >
          <div className="tooltip__date">{shortDate(week.days[hover].date)}</div>
          <div className="tooltip__row">
            Logged {formatKj(week.days[hover].consumedKj, units)} {unitLabel(units)}
          </div>
          <div className="tooltip__row">
            Allowed {formatKj(week.days[hover].allowanceKj, units)} {unitLabel(units)}
          </div>
        </div>
      )}

      <div className="legend">
        <span className="legend__item">
          <span className="legend__swatch" style={{ background: 'var(--series-1)' }} /> Logged
        </span>
        {anyOver && (
          <span className="legend__item">
            <span className="legend__swatch" style={{ background: 'var(--critical)' }} /> Over allowance
          </span>
        )}
        <span className="legend__item">
          <span className="legend__swatch" style={{ background: 'var(--text-muted)' }} /> Allowance
        </span>
        <button className="card__action" style={{ marginLeft: 'auto' }} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Hide numbers' : 'Show numbers'}
        </button>
      </div>

      {showTable && (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Energy logged and allowed for each day of the week</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Logged</th>
                <th scope="col">Allowed</th>
                <th scope="col">Diff</th>
              </tr>
            </thead>
            <tbody>
              {week.days.map((d) => (
                <tr key={d.date}>
                  <td>{shortDate(d.date)}</td>
                  <td>{d.consumedKj ? formatKj(d.consumedKj, units) : '–'}</td>
                  <td>{formatKj(d.allowanceKj, units)}</td>
                  <td style={{ color: d.consumedKj > d.allowanceKj ? 'var(--critical)' : undefined }}>
                    {d.consumedKj ? (d.consumedKj > d.allowanceKj ? '+' : '−') : ''}
                    {d.consumedKj ? formatKj(Math.abs(d.consumedKj - d.allowanceKj), units) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
