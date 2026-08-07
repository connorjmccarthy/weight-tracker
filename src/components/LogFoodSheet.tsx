import { useMemo, useState } from 'react'
import type { DateStr, Food, Meal } from '../lib/types'
import { MEALS } from '../lib/types'
import { useStore } from '../state'
import { searchFoods } from '../lib/search'
import { PORTION_PRESETS } from '../lib/energy'
import { formatKj, unitLabel } from '../lib/format'
import { Sheet } from './Sheet'
import { CustomFoodForm } from './CustomFoodForm'

interface Props {
  date: DateStr
  /** Pre-selects the meal so logging from a meal heading skips a step. */
  meal?: Meal
  /** Skips search and goes straight to the portion step. */
  preselected?: Food
  onClose: () => void
}

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

/** Meal defaults to whatever it plausibly is right now, so it rarely needs touching. */
function guessMeal(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export function LogFoodSheet({ date, meal, preselected, onClose }: Props) {
  const { state, addEntry, recentFoodIds, toggleFavourite, isFavourite, profile } = useStore()
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Food | null>(preselected ?? null)
  const [servings, setServings] = useState(1)
  const [chosenMeal, setChosenMeal] = useState<Meal>(meal ?? guessMeal())
  const [creating, setCreating] = useState(false)

  const recents = useMemo(() => recentFoodIds(20), [recentFoodIds])
  const results = useMemo(
    () => searchFoods(state.foods, query, { favouriteIds: state.favouriteIds, recentIds: recents }),
    [state.foods, query, state.favouriteIds, recents],
  )

  if (creating) {
    return (
      <Sheet title="New food" onClose={() => setCreating(false)}>
        <CustomFoodForm
          initialName={query}
          onDone={(food) => {
            setCreating(false)
            setChosen(food)
          }}
          onCancel={() => setCreating(false)}
        />
      </Sheet>
    )
  }

  if (chosen) {
    const kj = chosen.kj * servings
    return (
      <Sheet title={chosen.name} onClose={onClose}>
        <p className="secondary" style={{ marginTop: 0, fontSize: 14 }}>
          {chosen.servingLabel}
          {chosen.brand ? ` · ${chosen.brand}` : ''}
        </p>

        <div className="hero" style={{ marginBottom: 18 }}>
          <div>
            <span className="hero__value" style={{ fontSize: 40 }}>
              {formatKj(kj, profile.units)}
            </span>
            <span className="hero__unit">{unitLabel(profile.units)}</span>
          </div>
          {(chosen.protein || chosen.carbs || chosen.fat) && (
            <div className="hero__aside">
              {Math.round((chosen.protein ?? 0) * servings)}p · {Math.round((chosen.carbs ?? 0) * servings)}c ·{' '}
              {Math.round((chosen.fat ?? 0) * servings)}f
            </div>
          )}
        </div>

        <div className="field">
          <span className="field__label">How much?</span>
          <div className="chips">
            {PORTION_PRESETS.map((p) => (
              <button
                key={p.label}
                className="chip"
                aria-pressed={Math.abs(servings - p.mult) < 0.001}
                onClick={() => setServings(p.mult)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="field__hint">
            Sizing by eye is fine. Being roughly right every day beats being exactly right for a week and then
            quitting.
          </p>
        </div>

        <div className="field">
          <span className="field__label">Or set it exactly</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0.25"
            value={servings}
            onChange={(e) => setServings(Math.max(0.25, Number(e.target.value) || 1))}
          />
          <p className="field__hint">Servings of "{chosen.servingLabel}"</p>
        </div>

        <div className="field">
          <span className="field__label">Meal</span>
          <div className="chips">
            {MEALS.map((m) => (
              <button key={m} className="chip" aria-pressed={chosenMeal === m} onClick={() => setChosenMeal(m)}>
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {chosen.confidence === 'low' && (
          <div className="note note--warning">
            <span className="note__icon" aria-hidden="true">
              ⚠
            </span>
            <span>
              This figure is an estimate, not a published nutrition panel. If you eat it often, it's worth
              checking the real number once and editing it.
            </span>
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 20 }}>
          <button
            className="btn btn--primary btn--block"
            onClick={() => {
              addEntry(chosen, servings, chosenMeal, date)
              onClose()
            }}
          >
            Add to {MEAL_LABELS[chosenMeal].toLowerCase()}
          </button>
        </div>
        {!preselected && (
          <button className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={() => setChosen(null)}>
            ← Pick something else
          </button>
        )}
      </Sheet>
    )
  }

  return (
    <Sheet title="Add food" onClose={onClose}>
      <input
        className="input"
        type="search"
        placeholder="Search foods…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      <div style={{ marginTop: 14 }}>
        {results.length === 0 && (
          <div className="empty">
            <div className="empty__title">Nothing matches "{query}"</div>
            Add it once and it'll be there every time after.
          </div>
        )}

        {results.map((food) => (
          <div className="result" key={food.id}>
            <button
              className="result__body"
              style={{ textAlign: 'left' }}
              onClick={() => {
                setChosen(food)
                setServings(1)
              }}
            >
              <div className="result__name">{food.name}</div>
              <div className="result__meta">
                {food.servingLabel}
                {food.brand ? ` · ${food.brand}` : ''}
              </div>
            </button>
            <span className="result__kj">
              {formatKj(food.kj, profile.units)} {unitLabel(profile.units)}
            </span>
            <button
              className="result__star"
              aria-pressed={isFavourite(food.id)}
              aria-label={isFavourite(food.id) ? `Remove ${food.name} from favourites` : `Add ${food.name} to favourites`}
              onClick={() => toggleFavourite(food.id)}
            >
              {isFavourite(food.id) ? '★' : '☆'}
            </button>
          </div>
        ))}
      </div>

      <button className="btn btn--block" style={{ marginTop: 16 }} onClick={() => setCreating(true)}>
        + Add a food that isn't here
      </button>
    </Sheet>
  )
}
