import type { Profile } from '../types'

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function WeightBodyFatKpi({ profile }: { profile: Profile }) {
  const remaining: string[] = []
  if (profile.targetWeightKg) remaining.push(`${fmtNum(Math.abs(profile.weightKg - profile.targetWeightKg))} kg`)
  if (profile.bodyFatPct != null && profile.bodyFatTargetPct != null) {
    remaining.push(`${fmtNum(Math.round(Math.abs(profile.bodyFatPct - profile.bodyFatTargetPct) * 10) / 10)} p.p. de gordura`)
  }

  return (
    <div>
      <div className="grid grid-cols-4 overflow-hidden rounded-[12px] border border-[var(--line)]">
        <Kpi label="Peso atual" value={fmtNum(profile.weightKg)} color="var(--blue)" />
        <Kpi label="Peso-meta" value={profile.targetWeightKg ? fmtNum(profile.targetWeightKg) : '—'} color="var(--teal)" />
        <Kpi label="Gordura atual" value={profile.bodyFatPct != null ? `${fmtNum(profile.bodyFatPct)}%` : '—'} color="var(--orange)" />
        <Kpi label="Gordura-meta" value={profile.bodyFatTargetPct != null ? `${fmtNum(profile.bodyFatTargetPct)}%` : '—'} color="var(--blue-light)" />
      </div>
      {remaining.length > 0 ? (
        <p className="mt-2.5 text-center text-[0.85rem]">
          <span>Faltam {remaining.join(' e ')} para a meta</span>
        </p>
      ) : (
        <p className="mt-2.5 text-center text-[0.82rem] text-[var(--text-soft)]">
          Defina peso-meta e % de gordura-meta para ver quanto falta.
        </p>
      )}
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border-l border-[var(--line)] px-2 py-3 text-center first:border-l-0" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="text-[1.15rem] font-extrabold" style={{ color }}>
        {value}
      </div>
      <div className="text-[0.62rem] uppercase tracking-wide text-[var(--text-soft)]">{label}</div>
    </div>
  )
}
