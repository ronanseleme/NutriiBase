import { useState } from 'react'
import type { Profile } from '../../types'

interface Props {
  profile: Profile
  onSave: (updates: Partial<Omit<Profile, 'id' | 'targets'>>) => Promise<{ error: Error | null }>
}

const inputCls = 'nb-input'

export function GoalsForm({ profile, onSave }: Props) {
  const [targetWeightKg, setTargetWeightKg] = useState(profile.targetWeightKg != null ? String(profile.targetWeightKg) : '')
  const [bodyFatTargetPct, setBodyFatTargetPct] = useState(profile.bodyFatTargetPct != null ? String(profile.bodyFatTargetPct) : '')
  const [targetDate, setTargetDate] = useState(profile.targetDate || '')
  const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState(profile.weeklyWorkoutGoal != null ? String(profile.weeklyWorkoutGoal) : '')
  const [metaDescricao, setMetaDescricao] = useState(profile.metaDescricao || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: saveError } = await onSave({
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
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div>
      <label className="mb-3 flex flex-col gap-1.5">
        <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Seu objetivo, com suas palavras</span>
        <textarea
          placeholder="Ex: Objetivo: emagrecer e perder gordura corporal, mantendo a massa muscular através de dieta consistente e treino de força regular."
          value={metaDescricao}
          onChange={(e) => setMetaDescricao(e.target.value)}
          maxLength={280}
          className="nb-input min-h-16"
        />
        <span className="text-[0.72rem] text-[var(--text-soft)]">Aparece em destaque no topo desta aba.</span>
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
      <label className="mb-3 flex flex-col gap-1.5">
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
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="nb-btn nb-btn-primary w-full py-2.5"
      >
        {saving ? 'Salvando…' : saved ? '✓ Salvo!' : 'Salvar metas'}
      </button>
    </div>
  )
}
