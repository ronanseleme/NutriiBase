import { useState } from 'react'
import type { Profile } from '../../types'

interface Props {
  profile: Profile
  onSave: (updates: Partial<Omit<Profile, 'id' | 'targets'>>) => Promise<{ error: Error | null }>
}

export function MacroOverrideForm({ profile, onSave }: Props) {
  const [proteinG, setProteinG] = useState(
    profile.macroOverride?.proteinG != null ? String(profile.macroOverride.proteinG) : '',
  )
  const [fatG, setFatG] = useState(profile.macroOverride?.fatG != null ? String(profile.macroOverride.fatG) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOverridden = profile.macroOverride?.proteinG != null || profile.macroOverride?.fatG != null

  async function save(macroOverride: Profile['macroOverride']) {
    setSaving(true)
    setError(null)
    const { error: saveError } = await onSave({ macroOverride })
    setSaving(false)
    if (saveError) {
      setError('Não foi possível salvar, tente novamente.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  function handleSave() {
    save({
      proteinG: proteinG.trim() ? Math.max(0, Math.round(+proteinG)) : null,
      fatG: fatG.trim() ? Math.max(0, Math.round(+fatG)) : null,
    })
  }

  function handleUseAutomatic() {
    setProteinG('')
    setFatG('')
    save(null)
  }

  return (
    <div className="mt-4 border-t border-[var(--line)] pt-4">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
          Editar macros manualmente
        </div>
        {isOverridden && (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--blue)]">
            Personalizado
          </span>
        )}
      </div>
      <p className="mb-3 text-[0.78rem] text-[var(--text-soft)]">
        Defina proteína e gordura em gramas — o carboidrato sempre preenche o restante para bater a meta calórica.
        Deixe em branco para voltar ao cálculo automático.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Proteína (g)</span>
          <input
            type="number"
            min={0}
            placeholder="Automático"
            value={proteinG}
            onChange={(e) => setProteinG(e.target.value)}
            className="nb-input"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Gordura (g)</span>
          <input
            type="number"
            min={0}
            placeholder="Automático"
            value={fatG}
            onChange={(e) => setFatG(e.target.value)}
            className="nb-input"
          />
        </label>
      </div>
      {error && <div className="mb-3 text-[0.8rem] text-[var(--coral)]">{error}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="nb-btn nb-btn-primary flex-1 py-2.5">
          {saving ? 'Salvando…' : saved ? '✓ Salvo!' : 'Salvar macros'}
        </button>
        {isOverridden && (
          <button
            type="button"
            onClick={handleUseAutomatic}
            disabled={saving}
            className="nb-btn nb-btn-secondary px-4 py-2.5 text-sm"
          >
            Usar automático
          </button>
        )}
      </div>
    </div>
  )
}
