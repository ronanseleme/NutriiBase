import { useState } from 'react'
import { WORKOUT_TYPES, computeWorkoutKcal, defaultWorkoutForm, workoutToForm, type WorkoutForm } from '../../lib/workout'
import { uid } from '../../lib/uid'
import type { DayLog, Workout, WorkoutIntensity } from '../../types'

function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

interface Props {
  log: DayLog
  weightKg: number
  onSaveWorkout: (workout: Workout, isEdit: boolean) => Promise<{ error: Error | null }>
  onDeleteWorkout: (workoutId: string) => Promise<{ error: Error | null }>
}

const INTENSITIES: WorkoutIntensity[] = ['leve', 'moderada', 'intensa']

export function WorkoutTab({ log, weightKg, onSaveWorkout, onDeleteWorkout }: Props) {
  const [form, setForm] = useState<WorkoutForm>(defaultWorkoutForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRun = form.type === 'corrida'
  const kcalEstimate = computeWorkoutKcal(form, weightKg)
  const dayTotal = log.workouts.reduce((s, w) => s + w.kcal, 0)

  function startEdit(w: Workout) {
    setEditingId(w.id)
    setForm(workoutToForm(w))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(defaultWorkoutForm())
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const entry: Workout = {
      id: editingId || uid(),
      kcal: kcalEstimate,
      type: form.type,
      mode: form.mode,
      durationMin: form.durationMin,
      intensity: form.intensity,
      distanceKm: form.distanceKm,
      paceMinKm: form.paceMinKm,
      note: form.note,
    }
    const { error: saveError } = await onSaveWorkout(entry, !!editingId)
    setSaving(false)
    if (saveError) {
      setError('Não foi possível salvar, tente novamente.')
      return
    }
    cancelEdit()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[18px] bg-[var(--surface)] p-4 shadow-[0_1px_2px_rgba(43,43,51,.06),0_10px_26px_-16px_rgba(43,43,51,.28)]">
        <div className="mb-3 font-[Space_Grotesk] font-bold">{editingId ? 'Editar treino' : 'Registrar treino'}</div>

        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Tipo de atividade</span>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as WorkoutForm['type'], mode: 'duracao' })}
            className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:border-[var(--blue)]"
          >
            {WORKOUT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {isRun && (
          <div className="mb-3 flex overflow-hidden rounded-[9px] border border-[var(--line-strong)]">
            <button
              type="button"
              onClick={() => setForm({ ...form, mode: 'duracao' })}
              className={`flex-1 py-2 text-[0.8rem] font-semibold ${form.mode === 'duracao' ? 'bg-[var(--blue)] text-white' : 'bg-[var(--surface)]'}`}
            >
              Tempo + intensidade
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, mode: 'distancia' })}
              className={`flex-1 py-2 text-[0.8rem] font-semibold ${form.mode === 'distancia' ? 'bg-[var(--blue)] text-white' : 'bg-[var(--surface)]'}`}
            >
              Distância + pace
            </button>
          </div>
        )}

        {isRun && form.mode === 'distancia' ? (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Distância (km)</span>
              <input
                type="number"
                step={0.1}
                min={0}
                value={form.distanceKm}
                onChange={(e) => setForm({ ...form, distanceKm: +e.target.value || 0 })}
                className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:border-[var(--blue)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Pace (min/km)</span>
              <input
                type="number"
                step={0.1}
                min={0}
                value={form.paceMinKm}
                onChange={(e) => setForm({ ...form, paceMinKm: +e.target.value || 0 })}
                className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:border-[var(--blue)]"
              />
            </label>
          </div>
        ) : (
          <div className="mb-3">
            <div className="mb-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Duração (min)</span>
                <input
                  type="number"
                  min={1}
                  value={form.durationMin}
                  onChange={(e) => setForm({ ...form, durationMin: +e.target.value || 0 })}
                  className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:border-[var(--blue)]"
                />
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Intensidade</span>
              <div className="flex overflow-hidden rounded-[9px] border border-[var(--line-strong)]">
                {INTENSITIES.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm({ ...form, intensity: i })}
                    className={`flex-1 py-2 text-[0.8rem] font-semibold capitalize ${form.intensity === i ? 'bg-[var(--blue)] text-white' : 'bg-[var(--surface)]'}`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Observações (opcional)</span>
          <textarea
            placeholder="Ex: treino de perna, RPE 8"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="min-h-12 rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] p-2.5 outline-none focus:border-[var(--blue)]"
          />
        </label>

        <div className="mb-3 flex items-center justify-between rounded-[10px] bg-[var(--bg)] px-3 py-2.5">
          <span className="text-[0.85rem] text-[var(--text-soft)]">Gasto estimado</span>
          <span className="font-bold">{fmtNum(kcalEstimate)} kcal</span>
        </div>

        {error && <div className="mb-3 text-[0.8rem] text-[var(--coral)]">{error}</div>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-[10px] bg-[var(--orange)] py-2.5 font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Salvar treino'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded-[10px] border border-[var(--line-strong)] px-4 py-2.5 text-sm font-bold">
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="rounded-[18px] bg-[var(--surface)] p-4 shadow-[0_1px_2px_rgba(43,43,51,.06),0_10px_26px_-16px_rgba(43,43,51,.28)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-[Space_Grotesk] font-bold">Treinos de hoje</span>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--teal)_14%,var(--surface))] px-2.5 py-1 text-[0.75rem] font-bold text-[var(--teal)]">
            {fmtNum(dayTotal)} kcal
          </span>
        </div>
        {log.workouts.length === 0 && (
          <div className="py-2 text-[0.85rem] italic text-[var(--text-soft)]">Nenhum treino registrado hoje.</div>
        )}
        {log.workouts.map((w) => {
          const label = WORKOUT_TYPES.find((t) => t.key === w.type)?.label || w.type
          const sub =
            w.mode === 'distancia'
              ? `${w.distanceKm} km · pace ${w.paceMinKm} min/km`
              : `${w.durationMin || 0} min · ${w.intensity || ''}`
          return (
            <div key={w.id} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{label}</div>
                <div className="text-[0.78rem] text-[var(--text-soft)]">
                  {sub}
                  {w.note ? ` · ${w.note}` : ''}
                </div>
              </div>
              <div className="shrink-0 font-bold">{fmtNum(w.kcal)} kcal</div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(w)}
                  aria-label="Editar treino"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-[var(--bg)]"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteWorkout(w.id)}
                  aria-label="Remover treino"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-[var(--bg)] hover:text-[var(--coral)]"
                >
                  ×
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
