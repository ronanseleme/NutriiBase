export function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

export function toISODate(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function formatDateLabel(iso: string): string {
  const t = todayISO()
  const y = toISODate(addDays(new Date(), -1))
  const dateNum = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(parseISODate(iso))
  if (iso === t) return `Hoje, ${dateNum}`
  if (iso === y) return `Ontem, ${dateNum}`
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    parseISODate(iso),
  )
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

export function monthLabel(y: number, m: number): string {
  const s = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
