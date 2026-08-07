import { useState } from 'react'
import { StoreProvider } from './state'
import { TodayView } from './components/TodayView'
import { WeightView } from './components/WeightView'
import { FoodsView } from './components/FoodsView'
import { PlanView } from './components/PlanView'
import './styles/app.css'

type Tab = 'today' | 'weight' | 'foods' | 'plan'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '◍' },
  { id: 'weight', label: 'Weight', icon: '⌁' },
  { id: 'foods', label: 'Foods', icon: '☰' },
  { id: 'plan', label: 'Plan', icon: '◎' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('today')

  return (
    <StoreProvider>
      <div className="app">
        <main className="app__main">
          {tab === 'today' && <TodayView />}
          {tab === 'weight' && <WeightView />}
          {tab === 'foods' && <FoodsView />}
          {tab === 'plan' && <PlanView />}
        </main>

        <nav className="tabbar" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="tabbar__btn"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => {
                setTab(t.id)
                window.scrollTo({ top: 0 })
              }}
            >
              <span className="tabbar__icon" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </StoreProvider>
  )
}
