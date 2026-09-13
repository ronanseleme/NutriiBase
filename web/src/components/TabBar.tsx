export type TabKey = 'dashboard' | 'food' | 'workout' | 'goals' | 'assistant' | 'admin' | 'profile'

function DashboardIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x={2.5} y={2.5} width={6.5} height={6.5} rx={1.5} stroke="currentColor" strokeWidth={1.6} />
      <rect x={11} y={2.5} width={6.5} height={4} rx={1.5} stroke="currentColor" strokeWidth={1.6} />
      <rect x={11} y={8.5} width={6.5} height={9} rx={1.5} stroke="currentColor" strokeWidth={1.6} />
      <rect x={2.5} y={11} width={6.5} height={6.5} rx={1.5} stroke="currentColor" strokeWidth={1.6} />
    </svg>
  )
}

function FoodIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 2v6.5a2 2 0 0 0 2 2v7.5M4 2v4M4 2a2 2 0 0 0-1 3.732V8.5a2 2 0 0 0 2 2m2-8.5v6.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 2c-2 0-3.5 2.2-3.5 5.5S13 12 14 12v6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function WorkoutIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 8v4M17.5 8v4M5 6.5v7M15 6.5v7M5 10h10"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GoalsIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx={10} cy={10} r={7.25} stroke="currentColor" strokeWidth={1.5} />
      <circle cx={10} cy={10} r={4} stroke="currentColor" strokeWidth={1.5} />
      <circle cx={10} cy={10} r={1} fill="currentColor" />
    </svg>
  )
}

function AssistantIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 9.5A6.25 6.25 0 0 1 9.25 3.25H10.75A6.25 6.25 0 0 1 17 9.5v0a6.25 6.25 0 0 1-6.25 6.25H8l-3.5 2.25.5-3.25A6.24 6.24 0 0 1 3 9.5v0Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2.5 16 4.75v4.3c0 4-2.6 6.9-6 8.45-3.4-1.55-6-4.45-6-8.45v-4.3z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d="M7.5 10 9 11.5 12.5 8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TABS: { key: TabKey; label: string; Icon: () => React.ReactElement }[] = [
  { key: 'dashboard', label: 'Painel', Icon: DashboardIcon },
  { key: 'food', label: 'Alimentação', Icon: FoodIcon },
  { key: 'workout', label: 'Treino', Icon: WorkoutIcon },
  { key: 'goals', label: 'Metas', Icon: GoalsIcon },
  { key: 'assistant', label: 'Chat', Icon: AssistantIcon },
  { key: 'admin', label: 'Admin', Icon: AdminIcon },
]

interface Props {
  active: TabKey
  onChange: (tab: TabKey) => void
  showAdmin: boolean
}

export function TabBar({ active, onChange, showAdmin }: Props) {
  const tabs = showAdmin ? TABS : TABS.filter((t) => t.key !== 'admin')
  return (
    <nav className="mx-auto flex max-w-md gap-1 px-2 pb-2" aria-label="Navegação principal">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.62rem] font-semibold transition-all ${
            active === t.key
              ? 'bg-[image:var(--brand-gradient)] text-white shadow-[0_6px_14px_-6px_rgba(47,111,237,.55)]'
              : 'text-[var(--text-soft)] hover:bg-[var(--bg)]'
          }`}
        >
          <t.Icon />
          <span className="whitespace-nowrap">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
