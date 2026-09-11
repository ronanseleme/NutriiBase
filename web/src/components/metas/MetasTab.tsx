import { leanMassKg } from '../../lib/calculations'
import { WeightBodyFatKpi } from '../WeightBodyFatKpi'
import { CalcMemoryKcal, CalcMemoryMacro } from '../CalcMemory'
import { GoalsForm } from './GoalsForm'
import { MacroOverrideForm } from './MacroOverrideForm'
import { parseISODate } from '../../lib/dateUtils'
import type { Profile } from '../../types'

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

interface Props {
  profile: Profile
  startWeight: number
  weekWorkoutCount: number
  onSaveProfile: (updates: Partial<Omit<Profile, 'id' | 'targets'>>) => Promise<{ error: Error | null }>
}

export function MetasTab({ profile, startWeight, weekWorkoutCount, onSaveProfile }: Props) {
  const t = profile.targets
  const leanMassNow = leanMassKg(profile)

  let progressPct: number | null = null
  if (profile.targetWeightKg) {
    const totalDelta = startWeight - profile.targetWeightKg
    const doneDelta = startWeight - profile.weightKg
    progressPct = totalDelta !== 0 ? Math.round((doneDelta / totalDelta) * 100) : 100
  }

  const combinationParts: string[] = []
  if (leanMassNow != null) {
    if (profile.bodyFatTargetPct != null && profile.bodyFatTargetPct > 0 && profile.bodyFatTargetPct < 70) {
      const impliedWeight = leanMassNow / (1 - profile.bodyFatTargetPct / 100)
      combinationParts.push(`${profile.bodyFatTargetPct}% de gordura equivaleria a aproximadamente ${impliedWeight.toFixed(1)} kg`)
    }
    if (profile.targetWeightKg) {
      const impliedBF = Math.max(0, 100 * (1 - leanMassNow / profile.targetWeightKg))
      combinationParts.push(`${profile.targetWeightKg} kg equivaleria a aproximadamente ${impliedBF.toFixed(1)}% de gordura`)
    }
  }

  const weeklyGoal = profile.weeklyWorkoutGoal
  const weeklyPct = weeklyGoal ? Math.round((weekWorkoutCount / weeklyGoal) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="nb-card">
        <div className="mb-3 font-[Space_Grotesk] font-bold">Meta de peso e composição corporal</div>
        <WeightBodyFatKpi profile={profile} />

        {progressPct != null && (
          <div className="mt-3.5">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, progressPct))}%`, background: progressPct >= 100 ? 'var(--teal)' : 'var(--blue)' }}
              />
            </div>
            <p className="mt-2 text-[0.8rem] text-[var(--text-soft)]">
              Começou em {fmtNum(startWeight)} kg
              {profile.targetDate ? ` · meta até ${new Intl.DateTimeFormat('pt-BR').format(parseISODate(profile.targetDate))}` : ''}.
            </p>
          </div>
        )}

        {combinationParts.length > 0 && (
          <p className="mt-2.5 text-[0.8rem] text-[var(--text-soft)]">
            Mantendo sua massa magra atual (~{leanMassNow!.toFixed(1)} kg): {combinationParts.join(' · ')}.
          </p>
        )}

        <div className="my-4 border-t border-[var(--line)]" />
        <GoalsForm profile={profile} onSave={onSaveProfile} />
      </div>

      <div className="nb-card">
        <div className="mb-3 font-[Space_Grotesk] font-bold">Metas calóricas e de macros</div>
        <div className="mb-4 grid grid-cols-4 gap-2 rounded-[12px] bg-[var(--bg)] p-3 text-center">
          <div>
            <div className="text-[1.05rem] font-extrabold">{fmtNum(t.kcal)}</div>
            <div className="text-[0.65rem] text-[var(--text-soft)]">Kcal/dia</div>
          </div>
          <div>
            <div className="text-[1.05rem] font-extrabold" style={{ color: 'var(--protein)' }}>
              {fmtNum(t.protein)}
            </div>
            <div className="text-[0.65rem] text-[var(--text-soft)]">Prot g</div>
          </div>
          <div>
            <div className="text-[1.05rem] font-extrabold" style={{ color: 'var(--carb)' }}>
              {fmtNum(t.carb)}
            </div>
            <div className="text-[0.65rem] text-[var(--text-soft)]">Carb g</div>
          </div>
          <div>
            <div className="text-[1.05rem] font-extrabold" style={{ color: 'var(--fat)' }}>
              {fmtNum(t.fat)}
            </div>
            <div className="text-[0.65rem] text-[var(--text-soft)]">Gord g</div>
          </div>
        </div>
        <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
          Memória de cálculo — meta calórica
        </div>
        <CalcMemoryKcal t={t} />
        <div className="mb-2 mt-4 text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
          Memória de cálculo — macros
        </div>
        <CalcMemoryMacro p={profile} t={t} />
        <MacroOverrideForm profile={profile} onSave={onSaveProfile} />
      </div>

      {weeklyGoal ? (
        <div className="nb-card">
          <div className="mb-1 font-[Space_Grotesk] font-bold">Meta de treinos semanais</div>
          <p className="mb-2 text-[0.82rem] text-[var(--text-soft)]">
            {weekWorkoutCount} de {weeklyGoal} treinos esta semana
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, weeklyPct)}%`, background: weeklyPct >= 100 ? 'var(--teal)' : 'var(--blue-light)' }}
            />
          </div>
        </div>
      ) : (
        <div className="nb-card">
          <div className="mb-1 font-[Space_Grotesk] font-bold">Meta de treinos semanais</div>
          <p className="text-[0.85rem] text-[var(--text-soft)]">{weekWorkoutCount} treinos registrados esta semana.</p>
        </div>
      )}
    </div>
  )
}
