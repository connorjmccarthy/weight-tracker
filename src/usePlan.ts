import { useMemo } from 'react'
import { useStore } from './state'
import { computePlan, measureTdee } from './lib/energy'
import type { PlanSummary } from './lib/energy'
import { buildTrend, currentWeightKg, latestTrend, project, trendOn } from './lib/trend'
import type { Projection } from './lib/trend'
import { today } from './lib/date'
import type { MeasuredTdee } from './lib/energy'

export interface PlanView extends PlanSummary {
  projection: Projection
  /** The smoothed trend value, for showing on screen. May lag `currentKg` slightly. */
  displayKg: number | null
  measured: MeasuredTdee
  /** True while there aren't enough weigh-ins to say anything about the trend. */
  needsWeighIns: boolean
}

/**
 * The single place the app decides what "the plan" currently is.
 *
 * Everything downstream — today's allowance, the week chart, the coaching lines — reads
 * from here, so the numbers can never disagree with each other across screens.
 */
export function usePlan(asOf = today()): PlanView {
  const { state, profile } = useStore()

  return useMemo(() => {
    const points = buildTrend(state.weighIns, undefined, asOf)
    // Unbiased estimate for the maths; the lagging smoothed value is only for display.
    const currentKg = currentWeightKg(state.weighIns, asOf) ?? profile.startKg
    const displayKg = latestTrend(points)

    const measured = measureTdee(state.log, (d) => trendOn(points, d), asOf)
    const summary = computePlan({
      profile,
      currentKg,
      asOf,
      baseBurnKj:
        profile.useAdaptiveTdee && (measured.confidence === 'high' || measured.confidence === 'medium')
          ? measured.baseBurnKj
          : null,
    })

    return {
      ...summary,
      projection: project(state.weighIns, profile, asOf),
      displayKg,
      measured,
      needsWeighIns: state.weighIns.length < 3,
    }
  }, [state.weighIns, state.log, profile, asOf])
}
