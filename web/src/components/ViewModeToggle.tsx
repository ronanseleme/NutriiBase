export type ViewMode = 'daily' | 'monthly'

export function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="nb-segmented">
      <button
        type="button"
        onClick={() => onChange('daily')}
        className={`flex-1 py-1.5 px-3 text-[0.8rem] font-semibold transition-colors ${mode === 'daily' ? 'bg-[image:var(--blue-gradient)] text-white' : 'bg-[var(--surface)]'}`}
      >
        Diária
      </button>
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className={`flex-1 py-1.5 px-3 text-[0.8rem] font-semibold transition-colors ${mode === 'monthly' ? 'bg-[image:var(--blue-gradient)] text-white' : 'bg-[var(--surface)]'}`}
      >
        Mensal
      </button>
    </div>
  )
}
