import { describe, expect, it } from 'vitest'
import { searchFoods } from './search'
import { FOODS } from '../data/foods'
import { DEFAULT_TEMPLATES, STARTER_FAVOURITE_IDS } from '../data/templates'
import type { Food } from './types'

describe('the shipped food database', () => {
  it('has unique ids', () => {
    const ids = FOODS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every food a positive kilojoule value, except water', () => {
    for (const food of FOODS) {
      expect(Number.isFinite(food.kj), food.name).toBe(true)
      if (food.id !== 'water') expect(food.kj, food.name).toBeGreaterThan(0)
    }
  })

  it('reconciles stated energy with stated macros', () => {
    // The check that caught three overstated McMuffins and a 45%-high Frozen Coke.
    // Alcohol is exempt: its energy comes from ethanol, which is not a macro field.
    for (const food of FOODS) {
      if (food.category === 'alcohol') continue
      if (food.protein == null || food.carbs == null || food.fat == null) continue
      const fromMacros = food.protein * 17 + food.carbs * 17 + food.fat * 37
      if (fromMacros === 0) continue
      expect(Math.abs(fromMacros - food.kj) / food.kj, `${food.name}: ${food.kj} kJ vs ${Math.round(fromMacros)} from macros`).toBeLessThan(0.2)
    }
  })

  it('keeps nothing implausible for a single serving', () => {
    for (const food of FOODS) expect(food.kj, food.name).toBeLessThan(6000)
  })

  it('describes a serving for every food', () => {
    for (const food of FOODS) expect(food.servingLabel?.length, food.name).toBeGreaterThan(0)
  })
})

describe('seeded templates and favourites', () => {
  const ids = new Set(FOODS.map((f) => f.id))

  it('reference foods that actually exist', () => {
    for (const template of DEFAULT_TEMPLATES) {
      for (const item of template.items) {
        expect(ids.has(item.foodId), `${template.name} → ${item.foodId}`).toBe(true)
      }
    }
    for (const id of STARTER_FAVOURITE_IDS) expect(ids.has(id), id).toBe(true)
  })

  it('covers every day of the week', () => {
    const covered = new Set(DEFAULT_TEMPLATES.flatMap((t) => t.suggestOn ?? []))
    expect([...covered].sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})

describe('searchFoods', () => {
  it('returns everything when the query is empty', () => {
    expect(searchFoods(FOODS, '').length).toBeGreaterThan(0)
  })

  it('finds a food by a word in its name', () => {
    const names = searchFoods(FOODS, 'crumpet').map((f) => f.name.toLowerCase())
    expect(names.some((n) => n.includes('crumpet'))).toBe(true)
  })

  it('requires every term to match, so extra words narrow rather than widen', () => {
    const broad = searchFoods(FOODS, 'coffee')
    const narrow = searchFoods(FOODS, 'coffee latte')
    expect(narrow.length).toBeLessThan(broad.length)
  })

  it('ignores case, punctuation and apostrophes', () => {
    expect(searchFoods(FOODS, "grill'd").length).toBeGreaterThan(0)
    expect(searchFoods(FOODS, 'GRILLD').length).toBeGreaterThan(0)
    expect(searchFoods(FOODS, 'mcdonalds').length).toBeGreaterThan(0)
  })

  it('puts favourites first', () => {
    const results = searchFoods(FOODS, 'coffee', { favouriteIds: ['boss-coffee-iced-long-black-237ml-can'] })
    expect(results[0].id).toBe('boss-coffee-iced-long-black-237ml-can')
  })

  it('ranks a recently eaten food above an unused one', () => {
    const withRecent = searchFoods(FOODS, 'burger', { recentIds: ['pub-grill-burger-with-chips'] })
    expect(withRecent[0].id).toBe('pub-grill-burger-with-chips')
  })

  it('leaves archived foods out', () => {
    const archived: Food[] = [{ ...FOODS[0], id: 'gone', name: 'Zzz archived thing', archived: true }]
    expect(searchFoods([...FOODS, ...archived], 'archived')).toHaveLength(0)
  })

  it('returns nothing for a term that matches nothing', () => {
    expect(searchFoods(FOODS, 'xyzzy')).toHaveLength(0)
  })
})
