import { useState } from 'react'
import type { Profile } from '../../types'

const inputCls = 'nb-input'

interface Props {
  profile: Profile
  onSaveProfile: (updates: Partial<Omit<Profile, 'id' | 'targets'>>) => Promise<{ error: Error | null }>
  onBack: () => void
  onNext: () => void
}

export function StepGoals({ profile, onSaveProfile, onBack, onNext }: Props) {
  const [targetWeightKg, setTargetWeightKg] = useState(profile.targetWeightKg != null ? String(profile.targetWeightKg) : '')
  const [bodyFatTargetPct, setBodyFatTargetPct] = useState(profile.bodyFatTargetPct != null ? String(profile.bodyFatTargetPct) : '')
  const [targetDate, setTargetDate] = useState(profile.targetDate || '')
  const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState(profile.weeklyWorkoutGoal != null ? String(profile.weeklyWorkoutGoal) : '')
  const [metaDescricao, setMetaDescricao] = useState(profile.metaDescricao || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleNext() {
    setSaving(true)
    setError(null)
    const { error: saveError } = await onSaveProfile({
      targetWeightKg: targetWeightKg ? +targetWeightKg : null,
      bodyFatTargetPct: bodyFatTargetPct ? +bodyFatTargetPct : null,
      targetDate: targetDate || null,
      weeklyWorkoutGoal: weeklyWorkoutGoal ? +weeklyWorkoutGoal : null,
      metaDescricao: metaDescricao.trim(),
    })
    setSaving(false)
    if (saveError) {
      setError('Não foi possível salvar, tente novamente.')
      return
    }
    onNext()
  }

  return (
    <div className="nb-card">
      <h2 className="mb-1 text-[1.15rem] font-bold">Seu objetivo</h2>
      <p className="mb-4 text-[0.84rem] text-[var(--text-soft)]">Tudo opcional — dá pra ajustar depois na aba Metas.</p>

      <label className="mb-3 flex flex-col gap-1.5">
        <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Seu objetivo, com suas palavras</span>
        <textarea
          placeholder="Ex: Objetivo: emagrecer e perder gordura corporal, mantendo a massa muscular através de dieta consistente e treino de força regular."
          value={metaDescricao}
          onChange={(e) => setMetaDescricao(e.target.value)}
          maxLength={280}
          className="nb-input min-h-16"
        />
      </label>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Peso-meta (kg)</span>
          <input type="number" step={0.1} min={0} value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">% gordura-meta</span>
          <input type="number" step={0.1} min={3} max={60} value={bodyFatTargetPct} onChange={(e) => setBodyFatTargetPct(e.target.value)} className={inputCls} />
        </label>
      </div>
      <label className="mb-3 flex flex-col gap-1.5">
        <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Data-meta (opcional)</span>
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputCls} />
      </label>
      <label className="mb-4 flex flex-col gap-1.5">
        <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Treinos por semana</span>
        <input
          type="number"
          min={0}
          max={14}
          placeholder="Ex: 4"
          value={weeklyWorkoutGoal}
          onChange={(e) => setWeeklyWorkoutGoal(e.target.value)}
          className={inputCls}
        />
      </label>
      {error && <div className="mb-3 text-[0.8rem] text-[var(--coral)]">{error}</div>}
      <div className="flex gap-2.5">
        <button type="button" onClick={onBack} className="nb-btn nb-btn-secondary px-4 py-2.5 text-sm">
          Voltar
        </button>
        <button type="button" onClick={handleNext} disabled={saving} className="nb-btn nb-btn-primary flex-1 py-2.5">
          {saving ? 'Salvando…' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
