import { KJ_PER_KCAL } from './energy'
import type { Profile } from './types'

/** Australia labels food in kilojoules, so kJ is the primary unit; kcal is a toggle. */

export function formatKj(kj: number, units: Profile['units'] = 'kj'): string {
  if (units === 'kcal') return `${Math.round(kj / KJ_PER_KCAL).toLocaleString()}`
  return Math.round(kj).toLocaleString()
}

export function unitLabel(units: Profile['units'] = 'kj'): string {
  return units === 'kcal' ? 'kcal' : 'kJ'
}

export function formatEnergy(kj: number, units: Profile['units'] = 'kj'): string {
  return `${formatKj(kj, units)} ${unitLabel(units)}`
}

export function formatKg(kg: number, dp = 1): string {
  return `${kg.toFixed(dp)} kg`
}

export function formatSignedKg(kg: number, dp = 1): string {
  const sign = kg > 0 ? '+' : kg < 0 ? '−' : ''
  return `${sign}${Math.abs(kg).toFixed(dp)} kg`
}

export function pluralDays(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** "3 weeks", "2 months" — for a projection date that's a long way off. */
export function humanDuration(days: number): string {
  if (days < 14) return pluralDays(days)
  if (days < 70) {
    const w = Math.round(days / 7)
    return `${w} week${w === 1 ? '' : 's'}`
  }
  const m = Math.round(days / 30.44)
  return `${m} month${m === 1 ? '' : 's'}`
}

