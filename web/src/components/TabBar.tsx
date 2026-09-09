export type TabKey = 'dashboard' | 'food' | 'workout' | 'goals' | 'assistant'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Painel' },
  { key: 'food', label: 'Alimentação' },
  { key: 'workout', label: 'Treino' },
  { key: 'goals', label: 'Metas' },
  { key: 'assistant', label: 'Chat & Insights' },
]

interface Props {
  active: TabKey
  onChange: (tab: TabKey) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-2" aria-label="Navegação principal">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[0.82rem] font-semibold transition-colors ${
            active === t.key ? 'bg-[var(--blue)] text-white' : 'text-[var(--text-soft)] hover:bg-[var(--bg)]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}
