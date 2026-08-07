import { useMemo, useState } from 'react'
import type { DayTemplate, Food, Meal } from '../lib/types'
import { MEALS } from '../lib/types'
import { useStore } from '../state'
import { searchFoods } from '../lib/search'
import { formatKj, unitLabel } from '../lib/format'
import { newId } from '../lib/storage'
import { today } from '../lib/date'
import { Sheet } from './Sheet'
import { CustomFoodForm } from './CustomFoodForm'
import { LogFoodSheet } from './LogFoodSheet'

const DAY_OPTIONS: [number, string][] = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [0, 'Sun'],
]

export function FoodsView() {
  const store = useStore()
  const { state, profile, foodById, toggleFavourite, isFavourite } = store
  const [tab, setTab] = useState<'foods' | 'days'>('foods')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)
  const [logging, setLogging] = useState<Food | null>(null)
  const [editTemplate, setEditTemplate] = useState<DayTemplate | null>(null)

  const results = useMemo(
    () => searchFoods(state.foods, query, { favouriteIds: state.favouriteIds, limit: 200 }),
    [state.foods, query, state.favouriteIds],
  )

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar__title">Foods</h1>
          <div className="topbar__sub">
            {state.foods.filter((f) => !f.archived).length} foods · {state.templates.length} day templates
          </div>
        </div>
      </header>

      <div className="chips" style={{ marginTop: 14 }}>
        <button className="chip" aria-pressed={tab === 'foods'} onClick={() => setTab('foods')}>
          Foods
        </button>
        <button className="chip" aria-pressed={tab === 'days'} onClick={() => setTab('days')}>
          Day templates
        </button>
      </div>

      {tab === 'foods' ? (
        <section className="card">
          <input
            className="input"
            type="search"
            placeholder="Search foods…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button className="btn btn--block" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
            + New food
          </button>

          <div style={{ marginTop: 12 }}>
            {results.map((food) => (
              <div className="result" key={food.id}>
                <button className="result__body" onClick={() => setLogging(food)}>
                  <div className="result__name">{food.name}</div>
                  <div className="result__meta">
                    {food.servingLabel}
                    {food.confidence === 'low' ? ' · estimate' : ''}
                    {food.custom ? ' · yours' : ''}
                  </div>
                </button>
                <span className="result__kj">
                  {formatKj(food.kj, profile.units)} {unitLabel(profile.units)}
                </span>
                <button
                  className="result__star"
                  aria-pressed={isFavourite(food.id)}
                  aria-label={isFavourite(food.id) ? `Unfavourite ${food.name}` : `Favourite ${food.name}`}
                  onClick={() => toggleFavourite(food.id)}
                >
                  {isFavourite(food.id) ? '★' : '☆'}
                </button>
                <button className="result__star" aria-label={`Edit ${food.name}`} onClick={() => setEditing(food)}>
                  ✎
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="card">
          <p className="field__hint" style={{ marginTop: 0 }}>
            A template is a whole day of food you log in one tap. Yours are set up from the week you described —
            edit them as your habits change.
          </p>

          {state.templates.map((t) => (
            <div className="result" key={t.id}>
              <button className="result__body" onClick={() => setEditTemplate(t)}>
                <div className="result__name">
                  {t.emoji ? `${t.emoji} ` : ''}
                  {t.name}
                </div>
                <div className="result__meta">
                  {t.items.length} items
                  {t.suggestOn?.length
                    ? ` · ${t.suggestOn.map((d) => DAY_OPTIONS.find(([v]) => v === d)?.[1]).join(', ')}`
                    : ''}
                </div>
              </button>
              <span className="result__kj">
                {formatKj(
                  t.items.reduce((sum, it) => sum + (foodById(it.foodId)?.kj ?? 0) * it.servings, 0),
                  profile.units,
                )}{' '}
                {unitLabel(profile.units)}
              </span>
              <button
                className="result__star"
                aria-label={`Delete ${t.name}`}
                onClick={() => confirm(`Delete the "${t.name}" template?`) && store.removeTemplate(t.id)}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            className="btn btn--block"
            style={{ marginTop: 14 }}
            onClick={() => {
              const name = prompt('Name this template — e.g. "Typical Monday"')
              if (!name) return
              const made = store.templateFromDay(today(), name)
              if (!made) alert('Log today first, then save it as a template.')
            }}
          >
            + Save today as a template
          </button>
        </section>
      )}

      {creating && (
        <Sheet title="New food" onClose={() => setCreating(false)}>
          <CustomFoodForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
        </Sheet>
      )}

      {editing && (
        <Sheet title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <CustomFoodForm existing={editing} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
          <button
            className="btn btn--ghost btn--danger btn--block"
            style={{ marginTop: 10 }}
            onClick={() => {
              store.removeFood(editing.id)
              setEditing(null)
            }}
          >
            Hide this food
          </button>
          <p className="field__hint">
            Hiding keeps it out of search but leaves your past entries intact. If you corrected the kilojoules
            above, only meals logged from now on use the new figure — history stays as it was recorded.
          </p>
        </Sheet>
      )}

      {logging && <LogFoodSheet date={today()} preselected={logging} onClose={() => setLogging(null)} />}

      {editTemplate && <TemplateEditor template={editTemplate} onClose={() => setEditTemplate(null)} />}
    </>
  )
}

function TemplateEditor({ template, onClose }: { template: DayTemplate; onClose: () => void }) {
  const store = useStore()
  const { foodById, profile, state } = store
  const [draft, setDraft] = useState<DayTemplate>(template)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')

  const results = useMemo(() => (adding ? searchFoods(state.foods, query, { limit: 30 }) : []), [adding, query, state.foods])

  const save = () => {
    store.saveTemplate(draft)
    onClose()
  }

  return (
    <Sheet title={draft.name} onClose={onClose}>
      <label className="field">
        <span className="field__label">Name</span>
        <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>

      <div className="field">
        <span className="field__label">Suggest on these days</span>
        <div className="chips">
          {DAY_OPTIONS.map(([value, label]) => {
            const on = draft.suggestOn?.includes(value) ?? false
            return (
              <button
                key={value}
                className="chip"
                aria-pressed={on}
                onClick={() =>
                  setDraft({
                    ...draft,
                    suggestOn: on
                      ? (draft.suggestOn ?? []).filter((d) => d !== value)
                      : [...(draft.suggestOn ?? []), value],
                  })
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="field">
        <span className="field__label">What's in it</span>
        {draft.items.map((item, i) => {
          const food = foodById(item.foodId)
          return (
            <div className="entry" key={`${item.foodId}-${i}`}>
              <div className="entry__body">
                <div className="entry__name">{food?.name ?? 'Removed food'}</div>
                <div className="entry__meta">
                  <select
                    value={item.meal}
                    aria-label="Meal"
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        items: draft.items.map((it, j) => (j === i ? { ...it, meal: e.target.value as Meal } : it)),
                      })
                    }
                    style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 12.5 }}
                  >
                    {MEALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {' · ×'}
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={item.servings}
                    aria-label="Servings"
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        items: draft.items.map((it, j) =>
                          j === i ? { ...it, servings: Math.max(0.25, Number(e.target.value) || 1) } : it,
                        ),
                      })
                    }
                    style={{
                      width: 52,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-strong)',
                      color: 'inherit',
                      fontSize: 12.5,
                    }}
                  />
                </div>
              </div>
              <span className="entry__kj">{formatKj((food?.kj ?? 0) * item.servings, profile.units)}</span>
              <button
                className="entry__del"
                aria-label="Remove from template"
                onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      {adding ? (
        <>
          <input
            className="input"
            type="search"
            placeholder="Search foods…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8 }}>
            {results.map((f) => (
              <button
                className="result"
                key={f.id}
                onClick={() => {
                  setDraft({ ...draft, items: [...draft.items, { foodId: f.id, servings: 1, meal: 'dinner' }] })
                  setAdding(false)
                  setQuery('')
                }}
              >
                <span className="result__body">
                  <span className="result__name">{f.name}</span>
                  <span className="result__meta">{f.servingLabel}</span>
                </span>
                <span className="result__kj">{formatKj(f.kj, profile.units)}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button className="btn btn--block" onClick={() => setAdding(true)}>
          + Add a food to this template
        </button>
      )}

      <button className="btn btn--primary btn--block" style={{ marginTop: 14 }} onClick={save}>
        Save template
      </button>
      <button
        className="btn btn--ghost btn--block"
        style={{ marginTop: 8 }}
        onClick={() => {
          store.saveTemplate({ ...draft, id: newId('tpl'), name: `${draft.name} copy` })
          onClose()
        }}
      >
        Duplicate
      </button>
    </Sheet>
  )
}
