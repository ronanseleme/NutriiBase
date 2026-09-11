import type { Profile, Targets } from '../types'

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
function fmtSigned(n: number): string {
  return (n >= 0 ? '+' : '') + fmtNum(n)
}

function Step({ label, value, sub, isTotal }: { label: React.ReactNode; value: React.ReactNode; sub?: string; isTotal?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0 ${isTotal ? 'font-extrabold' : ''}`}>
      <div>
        <div className="text-[0.85rem]">{label}</div>
        {sub && <div className="text-[0.75rem] text-[var(--text-soft)]">{sub}</div>}
      </div>
      <div className="shrink-0 font-bold">{value}</div>
    </div>
  )
}

export function CalcMemoryKcal({ t }: { t: Targets }) {
  const tmbFormula = t.usingLBM ? `Katch-McArdle — usa sua massa magra estimada de ${fmtNum(t.leanMassKg)} kg` : 'Harris-Benedict (revisada)'
  return (
    <div>
      <Step label="TMB — o que seu corpo gasta parado, em repouso" value={`${fmtNum(t.tmb)} kcal`} sub={`Fórmula: ${tmbFormula}`} />
      <Step
        label={`× Fator de atividade — ${t.activityLabel}`}
        value={`GET ${fmtNum(t.get)} kcal`}
        sub={`GET = Gasto Energético Total (TMB × ${t.activityFactor})`}
      />
      <Step label={t.adjustmentLabel} value={`${fmtSigned(t.adjustmentKcal)} kcal`} />
      <Step label="Meta calórica diária" value={`${fmtNum(t.kcal)} kcal`} isTotal />
    </div>
  )
}

export function CalcMemoryMacro({ p, t }: { p: Profile; t: Targets }) {
  const proteinOverridden = p.macroOverride?.proteinG != null
  const fatOverridden = p.macroOverride?.fatG != null
  return (
    <div>
      <Step
        label={
          proteinOverridden
            ? 'Proteína — definida manualmente'
            : `Proteína — ${t.proteinPerKg} g/kg × ${fmtNum(t.proteinBaseKg)} kg${t.usingLBM ? ' de massa magra' : ' de peso corporal'}`
        }
        value={<span style={{ color: 'var(--protein)' }}>{fmtNum(t.protein)} g</span>}
      />
      <Step
        label={fatOverridden ? 'Gordura — definida manualmente' : `Gordura — ${t.fatPerKg} g/kg × ${fmtNum(p.weightKg)} kg de peso corporal`}
        value={<span style={{ color: 'var(--fat)' }}>{fmtNum(t.fat)} g</span>}
      />
      <Step
        label="Carboidrato — preenche o restante das calorias da meta"
        value={<span style={{ color: 'var(--carb)' }}>{fmtNum(t.carb)} g</span>}
      />
    </div>
  )
}
