import { useEffect, useRef } from 'react'
import { daysInMonth, formatDateLabel, pad, parseISODate, todayISO } from '../lib/dateUtils'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

interface Props {
  dateIso: string
  onChange: (iso: string) => void
}

export function DateNav({ dateIso, onChange }: Props) {
  const selected = parseISODate(dateIso)
  const y = selected.getFullYear()
  const m = selected.getMonth() + 1
  const d = selected.getDate()

  const today = parseISODate(todayISO())
  const todayY = today.getFullYear()
  const todayM = today.getMonth() + 1
  const todayD = today.getDate()

  const yearOptions: number[] = []
  for (let yy = todayY - 4; yy <= todayY; yy++) yearOptions.push(yy)

  const dim = daysInMonth(y, m)
  const days = Array.from({ length: dim }, (_, i) => i + 1)

  const selectedDayRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedDayRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [dateIso])

  function goTo(newY: number, newM: number, newD: number) {
    // não deixa navegar para um dia no futuro
    if (newY === todayY && newM === todayM && newD > todayD) newD = todayD
    else if (newY > todayY || (newY === todayY && newM > todayM)) {
      newM = todayM
      newY = todayY
      newD = Math.min(newD, todayD)
    }
    onChange(`${newY}-${pad(newM)}-${pad(newD)}`)
  }

  function changeYear(newY: number) {
    goTo(newY, m, Math.min(d, daysInMonth(newY, m)))
  }
  function changeMonth(newM: number) {
    goTo(y, newM, Math.min(d, daysInMonth(y, newM)))
  }

  return (
    <div className="nb-card mb-4 px-4 py-3">
      <div className="mb-1 flex items-center justify-center gap-2">
        <select
          aria-label="Ano"
          value={y}
          onChange={(e) => changeYear(+e.target.value)}
          className="nb-input w-auto rounded-full py-1.5 text-sm font-bold"
        >
          {yearOptions.map((yy) => (
            <option key={yy} value={yy}>
              {yy}
            </option>
          ))}
        </select>
        <select
          aria-label="Mês"
          value={m}
          onChange={(e) => changeMonth(+e.target.value)}
          className="nb-input w-auto rounded-full py-1.5 text-sm font-bold"
        >
          {MONTH_NAMES.map((label, idx) => {
            const mm = idx + 1
            const disabled = y === todayY && mm > todayM
            return (
              <option key={mm} value={mm} disabled={disabled}>
                {label}
              </option>
            )
          })}
        </select>
      </div>

      <p className="mb-2 text-center text-[0.8rem] text-[var(--text-soft)]">{formatDateLabel(dateIso)}</p>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((day) => {
          const disabled = y === todayY && m === todayM && day > todayD
          const isSelected = day === d
          const isToday = y === todayY && m === todayM && day === todayD
          return (
            <button
              key={day}
              ref={isSelected ? selectedDayRef : undefined}
              type="button"
              disabled={disabled}
              onClick={() => onChange(`${y}-${pad(m)}-${pad(day)}`)}
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
          )
        })}
      </div>
    </div>
  )
}
