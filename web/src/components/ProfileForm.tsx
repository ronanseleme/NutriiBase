import { useState } from 'react'
import { ACTIVITY, GOALS, PACES } from '../lib/constants'
import type { Profile } from '../types'

interface Props {
  profile: Profile
  onSave: (updates: Partial<Omit<Profile, 'id' | 'targets'>>) => Promise<{ error: Error | null }>
  onClose: () => void
}

export function ProfileForm({ profile, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    name: profile.name,
    age: profile.age,
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPct: profile.bodyFatPct,
    activity: profile.activity,
    goal: profile.goal,
    pace: profile.pace,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error: saveError } = await onSave(form)
    setSaving(false)
    if (saveError) {
      setError('Não foi possível salvar, tente novamente.')
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="max-h-[88vh] w-full max-w-md overflow-auto rounded-[18px] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgba(43,43,51,.06),0_10px_26px_-16px_rgba(43,43,51,.28)]">
        <h2 className="mb-1 text-[1.3rem] font-bold">Seu perfil</h2>
        <p className="mb-4 text-[0.84rem] text-[var(--text-soft)]">
          Usado para calcular sua TMB, GET e meta diária. Nada é salvo até você clicar em "Salvar perfil".
        </p>

        {error && (
          <div className="mb-3.5 rounded-[10px] border border-[color-mix(in_srgb,var(--coral)_35%,transparent)] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] px-3 py-2.5 text-[0.82rem] text-[var(--coral)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nome">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Idade">
              <input
                type="number"
                min={10}
                max={100}
                required
                value={form.age}
                onChange={(e) => setForm({ ...form, age: +e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Sexo biológico">
              <div className="flex overflow-hidden rounded-[9px] border border-[var(--line-strong)]">
                {(['F', 'M'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, sex: s })}
                    className={`flex-1 py-2 text-sm font-semibold ${
                      form.sex === s ? 'bg-[var(--blue)] text-white' : 'bg-[var(--bg)] text-[var(--text)]'
                    }`}
                  >
                    {s === 'F' ? 'Feminino' : 'Masculino'}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Altura (cm)">
              <input
                type="number"
                min={100}
                max={250}
                required
                value={form.heightCm}
                onChange={(e) => setForm({ ...form, heightCm: +e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Peso atual (kg)">
              <input
                type="number"
                step={0.1}
                min={30}
                max={300}
                required
                value={form.weightKg}
                onChange={(e) => setForm({ ...form, weightKg: +e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Percentual de gordura (%, opcional)">
            <input
              type="number"
              step={0.1}
              min={3}
              max={60}
              placeholder="Deixe em branco se não souber"
              value={form.bodyFatPct ?? ''}
              onChange={(e) => setForm({ ...form, bodyFatPct: e.target.value ? +e.target.value : null })}
              className={inputCls}
            />
          </Field>

          <Field label="Nível de atividade">
            <select
              value={form.activity}
              onChange={(e) => setForm({ ...form, activity: e.target.value as Profile['activity'] })}
              className={inputCls}
            >
              {ACTIVITY.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Objetivo">
              <select
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value as Profile['goal'] })}
                className={inputCls}
              >
                {GOALS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ritmo">
              <select
                value={form.pace}
                onChange={(e) => setForm({ ...form, pace: e.target.value as Profile['pace'] })}
                className={inputCls}
              >
                {PACES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-3 flex justify-end gap-2.5">
            <button type="button" onClick={onClose} className="rounded-[8px] border border-[var(--line-strong)] px-4 py-2 text-sm font-bold">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[8px] bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
            >
              {saving ? 'Salvando…' : 'Salvar perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--blue)]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">{label}</span>
      {children}
    </label>
  )
}
