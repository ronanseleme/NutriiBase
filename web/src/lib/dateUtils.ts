function pad(n: number): string {
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
  if (iso === t) return 'Hoje'
  if (iso === y) return 'Ontem'
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    parseISODate(iso),
  )
}
