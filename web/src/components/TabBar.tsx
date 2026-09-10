export type TabKey = 'dashboard' | 'food' | 'workout' | 'goals' | 'assistant' | 'admin'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Painel' },
  { key: 'food', label: 'Alimentação' },
  { key: 'workout', label: 'Treino' },
  { key: 'goals', label: 'Metas' },
  { key: 'assistant', label: 'Chat/Insights' },
  { key: 'admin', label: 'Administração' },
]

interface Props {
  active: TabKey
  onChange: (tab: TabKey) => void
  showAdmin: boolean
}

export function TabBar({ active, onChange, showAdmin }: Props) {
  const tabs = showAdmin ? TABS : TABS.filter((t) => t.key !== 'admin')
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-2" aria-label="Navegação principal">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[0.82rem] font-semibold transition-all ${
            active === t.key
              ? 'bg-[image:var(--brand-gradient)] text-white shadow-[0_6px_14px_-6px_rgba(47,111,237,.55)]'
              : 'text-[var(--text-soft)] hover:bg-[var(--bg)]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}
