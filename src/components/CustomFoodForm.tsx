import { useState } from 'react'
import type { Food, FoodCategory } from '../lib/types'
import { useStore } from '../state'
import { CATEGORY_LABELS } from '../lib/search'
import { KJ_PER_KCAL } from '../lib/energy'
import { newId } from '../lib/storage'

interface Props {
  initialName?: string
  existing?: Food
  onDone: (food: Food) => void
  onCancel: () => void
}

const CATEGORIES: FoodCategory[] = [
  'homecooked',
  'restaurant',
  'fastfood',
  'drink',
  'breakfast',
  'snack',
  'staple',
  'protein',
  'produce',
  'dessert',
  'alcohol',
]

export function CustomFoodForm({ initialName = '', existing, onDone, onCancel }: Props) {
  const { upsertFood, profile } = useStore()
  const [name, setName] = useState(existing?.name ?? initialName)
  const [servingLabel, setServingLabel] = useState(existing?.servingLabel ?? '1 serve')
  const [energy, setEnergy] = useState(
    existing ? String(Math.round(profile.units === 'kcal' ? existing.kj / KJ_PER_KCAL : existing.kj)) : '',
  )
  const [category, setCategory] = useState<FoodCategory>(existing?.category ?? 'homecooked')
  const [protein, setProtein] = useState(existing?.protein ? String(existing.protein) : '')
  const [carbs, setCarbs] = useState(existing?.carbs ? String(existing.carbs) : '')
  const [fat, setFat] = useState(existing?.fat ? String(existing.fat) : '')
  const [error, setError] = useState('')

  const submit = () => {
    const value = Number(energy)
    if (!name.trim()) return setError('Give it a name.')
    if (!Number.isFinite(value) || value <= 0) return setError('Enter the energy per serving.')

    const kj = profile.units === 'kcal' ? value * KJ_PER_KCAL : value
    const food: Food = {
      id: existing?.id ?? newId('food'),
      name: name.trim(),
      category,
      servingLabel: servingLabel.trim() || '1 serve',
      kj: Math.round(kj),
      protein: protein ? Number(protein) : undefined,
      carbs: carbs ? Number(carbs) : undefined,
      fat: fat ? Number(fat) : undefined,
      custom: true,
      source: 'Added by you',
      confidence: 'medium',
    }
    onDone(upsertFood(food))
  }

  return (
    <>
      <label className="field">
        <span className="field__label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dad's beef curry" />
      </label>

      <label className="field">
        <span className="field__label">One serving is…</span>
        <input
          className="input"
          value={servingLabel}
          onChange={(e) => setServingLabel(e.target.value)}
          placeholder="1 dinner plate"
        />
        <p className="field__hint">
          Describe the portion you normally have. Everything else scales off it, so you never need to weigh
          anything.
        </p>
      </label>

      <label className="field">
        <span className="field__label">Energy per serving ({profile.units === 'kcal' ? 'kcal' : 'kJ'})</span>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          value={energy}
          onChange={(e) => setEnergy(e.target.value)}
          placeholder={profile.units === 'kcal' ? '950' : '4000'}
        />
      </label>

      <div className="field">
        <span className="field__label">Category</span>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c} className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Macros per serving — optional</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="Protein g"
            aria-label="Protein in grams"
          />
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="Carbs g"
            aria-label="Carbohydrate in grams"
          />
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            placeholder="Fat g"
            aria-label="Fat in grams"
          />
        </div>
        <p className="field__hint">Skip these if you don't know them — energy is the number that drives the plan.</p>
      </div>

      {error && (
        <div className="note note--critical">
          <span className="note__icon" aria-hidden="true">
            ⚠
          </span>
          <span>{error}</span>
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn btn--primary" style={{ flex: 1 }} onClick={submit}>
          {existing ? 'Save changes' : 'Save food'}
        </button>
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  )
}
