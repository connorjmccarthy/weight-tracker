import type { Food, Id } from './types'

/**
 * Ranked food search.
 *
 * Deliberately not fuzzy. Fuzzy matching is what turns a search for "chicken" into four
 * hundred near-identical crowd-sourced entries — the exact failure that makes logging feel
 * like data entry. This matches on whole words, then ranks by how much you actually use
 * the thing, so the food you eat every day is the first result every time.
 */

export interface SearchOptions {
  favouriteIds?: Id[]
  recentIds?: Id[]
  limit?: number
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function searchFoods(foods: Food[], query: string, options: SearchOptions = {}): Food[] {
  const { favouriteIds = [], recentIds = [], limit = 40 } = options
  const q = normalise(query)
  const terms = q.split(' ').filter(Boolean)

  const favRank = new Map(favouriteIds.map((id, i) => [id, i]))
  const recentRank = new Map(recentIds.map((id, i) => [id, i]))

  const scored: { food: Food; score: number }[] = []

  for (const food of foods) {
    if (food.archived) continue

    const haystack = normalise(`${food.name} ${food.brand ?? ''} ${food.category}`)

    let score = 0
    if (terms.length === 0) {
      score = 1
    } else {
      let matchedAll = true
      for (const term of terms) {
        const idx = haystack.indexOf(term)
        if (idx === -1) {
          matchedAll = false
          break
        }
        // A word-start match beats a match buried mid-word.
        const atWordStart = idx === 0 || haystack[idx - 1] === ' '
        score += atWordStart ? (idx === 0 ? 40 : 25) : 8
      }
      if (!matchedAll) continue
    }

    if (favRank.has(food.id)) score += 60 - favRank.get(food.id)!
    if (recentRank.has(food.id)) score += 45 - recentRank.get(food.id)!
    if (food.custom) score += 5

    scored.push({ food, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((s) => s.food)
}

export const CATEGORY_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  fastfood: 'Fast food',
  drink: 'Drinks',
  homecooked: 'Home cooked',
  restaurant: 'Restaurant',
  snack: 'Snacks',
  staple: 'Staples',
  protein: 'Protein',
  produce: 'Fruit & veg',
  dessert: 'Dessert',
  alcohol: 'Alcohol',
}
