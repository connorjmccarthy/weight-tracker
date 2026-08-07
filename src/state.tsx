import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppState, DateStr, DayTemplate, Food, Id, LogEntry, Meal, Profile, WeighIn } from './lib/types'
import { load, newId, save } from './lib/storage'
import { daysBetween, today } from './lib/date'

interface Store {
  state: AppState
  profile: Profile
  setProfile: (patch: Partial<Profile>) => void

  addEntry: (food: Food, servings: number, meal: Meal, date?: DateStr) => void
  addEntries: (items: { food: Food; servings: number; meal: Meal }[], date?: DateStr) => void
  updateEntry: (id: Id, patch: Partial<Pick<LogEntry, 'servings' | 'meal'>>) => void
  removeEntry: (id: Id) => void
  copyDay: (from: DateStr, to: DateStr) => number

  upsertFood: (food: Food) => Food
  removeFood: (id: Id) => void
  toggleFavourite: (id: Id) => void
  isFavourite: (id: Id) => boolean

  setWeighIn: (date: DateStr, kg: number) => void
  removeWeighIn: (date: DateStr) => void

  saveTemplate: (template: DayTemplate) => void
  removeTemplate: (id: Id) => void
  /** Builds a template out of everything logged on a given day. */
  templateFromDay: (date: DateStr, name: string) => DayTemplate | null

  replaceAll: (next: AppState) => void
  resetAll: () => void

  foodById: (id: Id) => Food | undefined
  /** Food ids ordered by how often they've been logged recently. */
  recentFoodIds: (limit?: number) => Id[]
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => load())

  useEffect(() => {
    save(state)
  }, [state])

  const foodMap = useMemo(() => new Map(state.foods.map((f) => [f.id, f])), [state.foods])

  const foodById = useCallback((id: Id) => foodMap.get(id), [foodMap])

  const entryFrom = (food: Food, servings: number, meal: Meal, date: DateStr): LogEntry => ({
    id: newId('log'),
    date,
    foodId: food.id,
    servings,
    meal,
    at: Date.now(),
    // Snapshot the numbers: correcting a food's kJ tomorrow must not silently rewrite today.
    name: food.name,
    kjPerServing: food.kj,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  })

  const addEntry: Store['addEntry'] = useCallback((food, servings, meal, date = today()) => {
    setState((s) => ({ ...s, log: [...s.log, entryFrom(food, servings, meal, date)] }))
  }, [])

  const addEntries: Store['addEntries'] = useCallback((items, date = today()) => {
    setState((s) => ({
      ...s,
      log: [...s.log, ...items.map((it, i) => ({ ...entryFrom(it.food, it.servings, it.meal, date), at: Date.now() + i }))],
    }))
  }, [])

  const updateEntry: Store['updateEntry'] = useCallback((id, patch) => {
    setState((s) => ({ ...s, log: s.log.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  }, [])

  const removeEntry: Store['removeEntry'] = useCallback((id) => {
    setState((s) => ({ ...s, log: s.log.filter((e) => e.id !== id) }))
  }, [])

  const copyDay: Store['copyDay'] = useCallback((from, to) => {
    let copied = 0
    setState((s) => {
      const source = s.log.filter((e) => e.date === from)
      copied = source.length
      if (!source.length) return s
      const clones = source.map((e, i) => ({ ...e, id: newId('log'), date: to, at: Date.now() + i }))
      return { ...s, log: [...s.log.filter((e) => e.date !== to), ...clones] }
    })
    return copied
  }, [])

  const upsertFood: Store['upsertFood'] = useCallback((food) => {
    const withId = food.id ? food : { ...food, id: newId('food') }
    setState((s) => {
      const exists = s.foods.some((f) => f.id === withId.id)
      return {
        ...s,
        foods: exists ? s.foods.map((f) => (f.id === withId.id ? withId : f)) : [...s.foods, withId],
      }
    })
    return withId
  }, [])

  const removeFood: Store['removeFood'] = useCallback((id) => {
    // Archive rather than delete: past log entries reference this food by id, and a
    // hard delete would leave holes in a history the user can no longer explain.
    setState((s) => ({
      ...s,
      foods: s.foods.map((f) => (f.id === id ? { ...f, archived: true } : f)),
      favouriteIds: s.favouriteIds.filter((f) => f !== id),
    }))
  }, [])

  const toggleFavourite: Store['toggleFavourite'] = useCallback((id) => {
    setState((s) => ({
      ...s,
      favouriteIds: s.favouriteIds.includes(id) ? s.favouriteIds.filter((f) => f !== id) : [...s.favouriteIds, id],
    }))
  }, [])

  const isFavourite = useCallback((id: Id) => state.favouriteIds.includes(id), [state.favouriteIds])

  const setWeighIn: Store['setWeighIn'] = useCallback((date, kg) => {
    setState((s) => {
      const next: WeighIn = { date, kg, at: Date.now() }
      const others = s.weighIns.filter((w) => w.date !== date)
      const weighIns = [...others, next].sort((a, b) => a.date.localeCompare(b.date))

      /*
       * The first weigh-in anchors the goal line — but only if it's a current one.
       *
       * Back-dated history must never move the start. Someone who was 81 kg in June and
       * is 78.5 kg now would otherwise have their schedule redrawn from June, and be told
       * they're 3 kg behind a plan that only starts today. Old weights are there to show
       * the progress already made, not to be scored against.
       */
      const daysOld = daysBetween(date, today())
      const anchorsPlan = weighIns.length === 1 && daysOld >= 0 && daysOld <= 7

      return {
        ...s,
        weighIns,
        profile: anchorsPlan ? { ...s.profile, startKg: kg, startDate: date } : s.profile,
      }
    })
  }, [])

  const removeWeighIn: Store['removeWeighIn'] = useCallback((date) => {
    setState((s) => ({ ...s, weighIns: s.weighIns.filter((w) => w.date !== date) }))
  }, [])

  const saveTemplate: Store['saveTemplate'] = useCallback((template) => {
    setState((s) => {
      const exists = s.templates.some((t) => t.id === template.id)
      return {
        ...s,
        templates: exists ? s.templates.map((t) => (t.id === template.id ? template : t)) : [...s.templates, template],
      }
    })
  }, [])

  const removeTemplate: Store['removeTemplate'] = useCallback((id) => {
    setState((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }))
  }, [])

  const templateFromDay: Store['templateFromDay'] = useCallback(
    (date, name) => {
      const entries = state.log.filter((e) => e.date === date)
      if (!entries.length) return null
      const template: DayTemplate = {
        id: newId('tpl'),
        name,
        items: entries.map((e) => ({ foodId: e.foodId, servings: e.servings, meal: e.meal })),
      }
      setState((s) => ({ ...s, templates: [...s.templates, template] }))
      return template
    },
    [state.log],
  )

  const setProfile: Store['setProfile'] = useCallback((patch) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }))
  }, [])

  const replaceAll: Store['replaceAll'] = useCallback((next) => setState(next), [])

  const resetAll: Store['resetAll'] = useCallback(() => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('weight-tracker/v1')
    setState(load())
  }, [])

  const recentFoodIds: Store['recentFoodIds'] = useCallback(
    (limit = 12) => {
      const score = new Map<Id, number>()
      const now = Date.now()
      for (const e of state.log) {
        // Half-life of about a fortnight, so a habit that fades drops off the tiles.
        const ageDays = (now - e.at) / 86_400_000
        score.set(e.foodId, (score.get(e.foodId) ?? 0) + Math.pow(0.95, ageDays))
      }
      return [...score.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
        .filter((id) => foodMap.has(id))
        .slice(0, limit)
    },
    [state.log, foodMap],
  )

  const value = useMemo<Store>(
    () => ({
      state,
      profile: state.profile,
      setProfile,
      addEntry,
      addEntries,
      updateEntry,
      removeEntry,
      copyDay,
      upsertFood,
      removeFood,
      toggleFavourite,
      isFavourite,
      setWeighIn,
      removeWeighIn,
      saveTemplate,
      removeTemplate,
      templateFromDay,
      replaceAll,
      resetAll,
      foodById,
      recentFoodIds,
    }),
    [
      state,
      setProfile,
      addEntry,
      addEntries,
      updateEntry,
      removeEntry,
      copyDay,
      upsertFood,
      removeFood,
      toggleFavourite,
      isFavourite,
      setWeighIn,
      removeWeighIn,
      saveTemplate,
      removeTemplate,
      templateFromDay,
      replaceAll,
      resetAll,
      foodById,
      recentFoodIds,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
