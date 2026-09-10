import { useState } from 'react'
import { addDays, formatDateLabel, parseISODate, todayISO, toISODate } from '../lib/dateUtils'
import { CalendarModal } from './CalendarModal'

const WEEKDAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  dateIso: string
  onChange: (iso: string) => void
}

export function DateNav({ dateIso, onChange }: Props) {
  const [showCalendar, setShowCalendar] = useState(false)
  const selected = parseISODate(dateIso)
  const todayIso = todayISO()

  // semana (domingo a sábado) que contém a data selecionada
  const weekStart = addDays(selected, -selected.getDay())
  const weekDays = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)))

  const monthYearLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(selected)
  const monthYearCapitalized = monthYearLabel.charAt(0).toUpperCase() + monthYearLabel.slice(1)

  function shiftDay(delta: number) {
    const next = toISODate(addDays(selected, delta))
    if (delta > 0 && next > todayIso) return
    onChange(next)
  }

  return (
    <div className="nb-card mb-4 px-4 py-3">
      <button
        type="button"
        onClick={() => setShowCalendar(true)}
        className="mb-1 block w-full rounded-[10px] text-center font-bold transition-colors hover:bg-[var(--bg)]"
      >
        {monthYearCapitalized} <span className="text-[0.7rem] text-[var(--text-soft)]">▾</span>
      </button>

      <p className="mb-2 text-center text-[0.8rem] text-[var(--text-soft)]">{formatDateLabel(dateIso)}</p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          aria-label="Dia anterior"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold"
        >
          ‹
        </button>
        <div className="flex flex-1 justify-between gap-1">
          {weekDays.map((iso) => {
            const day = parseISODate(iso).getDate()
            const weekday = WEEKDAY_ABBR[parseISODate(iso).getDay()]
            const disabled = iso > todayIso
            const isSelected = iso === dateIso
            const isToday = iso === todayIso
            return (
              <div key={iso} className="flex flex-col items-center gap-1">
                <span className="text-[0.6rem] font-semibold uppercase text-[var(--text-soft)]">{weekday}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(iso)}
                  aria-current={isSelected ? 'date' : undefined}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.82rem] font-bold transition-all disabled:opacity-30 ${
                    isSelected
                      ? 'bg-[image:var(--blue-gradient)] text-white shadow-[0_6px_14px_-6px_rgba(47,111,237,.5)]'
                      : isToday
                        ? 'border-2 border-[var(--blue)] text-[var(--blue)]'
                        : 'border border-[var(--line-strong)] text-[var(--text)]'
                  }`}
                >
                  {day}
                </button>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => shiftDay(1)}
          disabled={dateIso >= todayIso}
          aria-label="Próximo dia"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {showCalendar && (
        <CalendarModal
          dateIso={dateIso}
          onSelect={(iso) => {
            onChange(iso)
            setShowCalendar(false)
          }}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  )
}
