import { useState } from 'react'
import { daysInMonth, pad, parseISODate, todayISO } from '../lib/dateUtils'

const WEEKDAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
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
  onSelect: (iso: string) => void
  onSelectRange: (start: string, end: string) => void
  onClose: () => void
}

export function CalendarModal({ dateIso, onSelect, onSelectRange, onClose }: Props) {
  const selected = parseISODate(dateIso)
  const [viewY, setViewY] = useState(selected.getFullYear())
  const [viewM, setViewM] = useState(selected.getMonth() + 1)
  const [dragStartIso, setDragStartIso] = useState<string | null>(null)
  const [dragCurrentIso, setDragCurrentIso] = useState<string | null>(null)

  const today = parseISODate(todayISO())
  const todayY = today.getFullYear()
  const todayM = today.getMonth() + 1
  const todayD = today.getDate()

  const isFutureMonth = viewY > todayY || (viewY === todayY && viewM > todayM)
  const isPastYearFloor = viewY <= todayY - 4

  function isDisabledIso(iso: string): boolean {
    const [yy, mm, dd] = iso.split('-').map(Number)
    return yy === todayY && mm === todayM && dd > todayD
  }

  function prevMonth() {
    if (viewM === 1) {
      setViewY((yy) => yy - 1)
      setViewM(12)
    } else {
      setViewM((mm) => mm - 1)
    }
  }
  function nextMonth() {
    if (isFutureMonth) return
    if (viewM === 12) {
      setViewY((yy) => yy + 1)
      setViewM(1)
    } else {
      setViewM((mm) => mm + 1)
    }
  }
  function prevYear() {
    if (isPastYearFloor) return
    setViewY((yy) => yy - 1)
  }
  function nextYear() {
    if (viewY >= todayY) return
    setViewY((yy) => yy + 1)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, iso: string) {
    if (isDisabledIso(iso)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragStartIso(iso)
    setDragCurrentIso(iso)
  }
  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragStartIso) return
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const iso = el?.closest('[data-day-iso]')?.getAttribute('data-day-iso')
    if (iso && !isDisabledIso(iso)) setDragCurrentIso(iso)
  }
  function finishDrag() {
    if (!dragStartIso || !dragCurrentIso) return
    if (dragStartIso === dragCurrentIso) {
      onSelect(dragStartIso)
    } else {
      const [s, e] = dragStartIso <= dragCurrentIso ? [dragStartIso, dragCurrentIso] : [dragCurrentIso, dragStartIso]
      onSelectRange(s, e)
    }
    setDragStartIso(null)
    setDragCurrentIso(null)
  }

  function inDrag(iso: string): boolean {
    if (!dragStartIso || !dragCurrentIso) return false
    const [s, e] = dragStartIso <= dragCurrentIso ? [dragStartIso, dragCurrentIso] : [dragCurrentIso, dragStartIso]
    return iso >= s && iso <= e
  }

  const dim = daysInMonth(viewY, viewM)
  const firstWeekday = new Date(viewY, viewM - 1, 1).getDay()
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="nb-modal w-full max-w-sm">
        <h2 className="mb-1 text-center text-[1.05rem] font-bold">Selecionar data</h2>
        <p className="mb-3 text-center text-[0.76rem] text-[var(--text-soft)]">
          Toque um dia, ou arraste para selecionar um período
        </p>

        <div className="mb-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={prevYear}
            disabled={isPastYearFloor}
            aria-label="Ano anterior"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold disabled:opacity-30"
          >
            ‹
          </button>
          <span className="min-w-[3.5rem] text-center font-bold">{viewY}</span>
          <button
            type="button"
            onClick={nextYear}
            disabled={viewY >= todayY}
            aria-label="Próximo ano"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <div className="mb-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Mês anterior"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold"
          >
            ‹
          </button>
          <span className="min-w-[7rem] text-center font-bold">{MONTH_NAMES[viewM - 1]}</span>
          <button
            type="button"
            onClick={nextMonth}
            disabled={isFutureMonth}
            aria-label="Próximo mês"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[0.62rem] font-bold uppercase text-[var(--text-soft)]">
          {WEEKDAY_ABBR.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" onPointerUp={finishDrag} onPointerCancel={finishDrag}>
          {cells.map((day, i) => {
            if (day == null) return <span key={`blank-${i}`} />
            const iso = `${viewY}-${pad(viewM)}-${pad(day)}`
            const disabled = isDisabledIso(iso)
            const isSelected = iso === dateIso || inDrag(iso)
            const isToday = viewY === todayY && viewM === todayM && day === todayD
            return (
              <button
                key={iso}
                type="button"
                data-day-iso={iso}
                disabled={disabled}
                onPointerDown={(e) => handlePointerDown(e, iso)}
                onPointerMove={handlePointerMove}
                onClick={(e) => {
                  if (e.detail === 0) onSelect(iso)
                }}
                className={`flex h-9 touch-none items-center justify-center rounded-full text-[0.82rem] font-bold transition-all disabled:opacity-30 ${
                  isSelected
                    ? 'bg-[image:var(--blue-gradient)] text-white shadow-[0_6px_14px_-6px_rgba(47,111,237,.5)]'
                    : isToday
                      ? 'border-2 border-[var(--blue)] text-[var(--blue)]'
                      : 'text-[var(--text)] hover:bg-[var(--bg)]'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>

        <button type="button" onClick={onClose} className="nb-btn nb-btn-secondary mt-4 w-full py-2.5">
          Fechar
        </button>
      </div>
    </div>
  )
}
