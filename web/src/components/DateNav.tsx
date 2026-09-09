import { addDays, formatDateLabel, parseISODate, todayISO, toISODate } from '../lib/dateUtils'

interface Props {
  dateIso: string
  onChange: (iso: string) => void
}

export function DateNav({ dateIso, onChange }: Props) {
  const isToday = dateIso >= todayISO()

  function shift(delta: number) {
    const next = toISODate(addDays(parseISODate(dateIso), delta))
    if (delta > 0 && next > todayISO()) return
    onChange(next)
  }

  return (
    <div className="nb-card mb-4 flex items-center justify-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="Dia anterior"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line-strong)] text-lg font-bold transition-colors hover:bg-[var(--bg)]"
      >
        ‹
      </button>
      <span className="min-w-[7rem] text-center font-bold">{formatDateLabel(dateIso)}</span>
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={isToday}
        aria-label="Próximo dia"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line-strong)] text-lg font-bold transition-colors hover:bg-[var(--bg)] disabled:opacity-30"
      >
        ›
      </button>
    </div>
  )
}
