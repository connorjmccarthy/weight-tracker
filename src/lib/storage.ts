import type { AppState, DateStr, Food, Profile } from './types'
import { FOODS } from '../data/foods'
import { DEFAULT_TEMPLATES, STARTER_FAVOURITE_IDS } from '../data/templates'
import { DEFAULT_PROFILE } from '../data/profile'
import { today } from './date'

const KEY = 'weight-tracker/v1'
export const SCHEMA_VERSION = 1

export function defaultState(now: DateStr = today()): AppState {
  return {
    version: SCHEMA_VERSION,
    profile: { ...DEFAULT_PROFILE, startDate: DEFAULT_PROFILE.startDate || now },
    foods: FOODS,
    log: [],
    weighIns: [],
    templates: DEFAULT_TEMPLATES,
    favouriteIds: STARTER_FAVOURITE_IDS,
  }
}

/**
 * Merges the shipped food list into the stored one on every load, so a new version of the
 * app can add foods without the user losing their custom entries or their edits. A stored
 * food always wins over the built-in of the same id — the user's correction is the truth.
 */
function mergeFoods(stored: Food[]): Food[] {
  const byId = new Map<string, Food>()
  for (const f of FOODS) byId.set(f.id, f)
  for (const f of stored) byId.set(f.id, f)
  return [...byId.values()]
}

function migrate(raw: unknown): AppState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base

  const state = raw as Partial<AppState>
  return {
    version: SCHEMA_VERSION,
    profile: { ...base.profile, ...(state.profile ?? {}) } as Profile,
    foods: mergeFoods(Array.isArray(state.foods) ? state.foods : []),
    log: Array.isArray(state.log) ? state.log : [],
    weighIns: Array.isArray(state.weighIns) ? state.weighIns : [],
    templates: Array.isArray(state.templates) && state.templates.length ? state.templates : base.templates,
    favouriteIds: Array.isArray(state.favouriteIds) ? state.favouriteIds : base.favouriteIds,
  }
}

export function load(): AppState {
  if (typeof localStorage === 'undefined') return defaultState()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    return migrate(JSON.parse(raw))
  } catch {
    // A corrupt blob must never brick the app — start clean rather than crash on boot.
    return defaultState()
  }
}

export function save(state: AppState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Could not save — storage may be full or blocked.', err)
  }
}

// --- Backup ----------------------------------------------------------------
// Browser storage is not durable: clearing site data, an aggressive privacy setting, or
// a new phone all wipe it. Export exists so months of logging can't evaporate silently.

export function exportJson(state: AppState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
}

export function importJson(text: string): AppState {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') throw new Error('That file is not a backup.')
  if (!('log' in parsed) && !('weighIns' in parsed)) {
    throw new Error('That file has no log or weigh-in data in it.')
  }
  return migrate(parsed)
}

export function download(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Spreadsheet-friendly export, for anyone who wants to do their own analysis. */
export function exportCsv(state: AppState): string {
  const rows: string[][] = [['date', 'meal', 'food', 'servings', 'kj', 'kcal', 'protein_g', 'carbs_g', 'fat_g']]
  const sorted = [...state.log].sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at)
  for (const e of sorted) {
    const kj = e.kjPerServing * e.servings
    rows.push([
      e.date,
      e.meal,
      e.name,
      String(e.servings),
      kj.toFixed(0),
      (kj / 4.184).toFixed(0),
      ((e.protein ?? 0) * e.servings).toFixed(1),
      ((e.carbs ?? 0) * e.servings).toFixed(1),
      ((e.fat ?? 0) * e.servings).toFixed(1),
    ])
  }
  return rows.map((r) => r.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')).join('\n')
}

export function newId(prefix = 'e'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}
