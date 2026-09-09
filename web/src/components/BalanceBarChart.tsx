export interface BalanceBar {
  key: string | number
  label: string
  saldo: number | null
  title: string
}

export function BalanceBarChart({ bars, height = 52 }: { bars: BalanceBar[]; height?: number }) {
  const maxAbs = Math.max(1, ...bars.map((b) => (b.saldo != null ? Math.abs(b.saldo) : 0)))
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {bars.map((b) => {
          const h = b.saldo != null ? Math.max(3, Math.round((Math.abs(b.saldo) / maxAbs) * (height - 8))) : 2
          const color = b.saldo == null ? 'var(--line)' : b.saldo > 0 ? 'var(--coral)' : 'var(--teal)'
          return (
            <div key={b.key} title={b.title} className="flex h-full flex-1 flex-col items-center justify-end">
              <div className="w-3/5 rounded-t-[3px]" style={{ height: h, background: color }} />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {bars.map((b) => (
          <div key={b.key} className="flex-1 text-center text-[0.55rem] leading-tight text-[var(--text-soft)]">
            {b.label}
          </div>
        ))}
      </div>
    </div>
  )
}
