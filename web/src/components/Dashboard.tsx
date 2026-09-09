import { useState } from 'react'
import { ACTIVITY, GOALS } from '../lib/constants'
import { dayFoodTotals, dayWorkoutKcal } from '../lib/calculations'
import { WeightBodyFatKpi } from './WeightBodyFatKpi'
import type { DayLog, Profile } from '../types'

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
function fmtSigned(n: number): string {
  return (n >= 0 ? '+' : '') + fmtNum(n)
}
function statusColor(pct: number): string {
  return pct <= 90 ? 'var(--teal)' : pct <= 105 ? 'var(--blue-light)' : 'var(--coral)'
}

interface Props {
  profile: Profile
  log: DayLog
  onEditProfile: () => void
  onSaveWeight: (kg: number) => Promise<{ error: Error | null }>
  onSaveBodyFat: (pct: number) => Promise<{ error: Error | null }>
}

export function Dashboard({ profile, log, onEditProfile, onSaveWeight, onSaveBodyFat }: Props) {
  const targets = profile.targets
  const food = dayFoodTotals(log.meals)
  const burn = dayWorkoutKcal(log.workouts)
  const metaAjustada = targets.kcal + burn
  const restante = metaAjustada - food.kcal
  const pct = metaAjustada > 0 ? Math.round((food.kcal / metaAjustada) * 100) : 0
  const color = statusColor(pct)

  const initials =
    profile.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || '?'
  const activityLabel = ACTIVITY.find((a) => a.key === profile.activity)?.label || profile.activity
  const goalLabel = GOALS.find((g) => g.key === profile.goal)?.label || profile.goal

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 truncate font-[Space_Grotesk] font-bold">{profile.name || 'Sem nome'}</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip>{profile.age} anos</Chip>
              <Chip>
                peso <b>{profile.weightKg} kg</b>
              </Chip>
              <Chip>{profile.heightCm} cm</Chip>
              <Chip title="Taxa metabólica basal — o que seu corpo gasta parado, em repouso">
                TMB <b>{targets.tmb} kcal</b> parado
              </Chip>
              <Chip>{activityLabel}</Chip>
              <Chip>{goalLabel}</Chip>
            </div>
          </div>
          <button
            type="button"
            onClick={onEditProfile}
            className="shrink-0 rounded-full border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold"
          >
            Editar
          </button>
        </div>
      </Card>

      <Card>
        <CardTitle>Peso e composição corporal</CardTitle>
        <WeightBodyFatKpi profile={profile} />
      </Card>

      <Card>
        <CardTitle>Balanço do dia</CardTitle>
        <div className="grid grid-cols-4 gap-0 overflow-hidden rounded-[12px] border border-[var(--line)]">
          <Kpi label="Meta" value={fmtNum(targets.kcal)} color="var(--blue)" />
          <Kpi label="Gasto total" value={fmtNum(targets.tmb + burn)} color="var(--teal)" />
          <Kpi label="Consumo" value={fmtNum(food.kcal)} color="var(--orange)" />
          <Kpi label="Saldo" value={fmtSigned(restante)} color={restante < 0 ? 'var(--coral)' : 'var(--teal)'} />
        </div>
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[0.82rem]">
            <span>{pct}% da meta ajustada</span>
            <b>{fmtNum(metaAjustada)} kcal</b>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Macros do dia</CardTitle>
        <MacroRow label="Proteína" consumed={food.protein} target={targets.protein} color="var(--protein)" />
        <MacroRow label="Carboidratos" consumed={food.carbs} target={targets.carb} color="var(--carb)" />
        <MacroRow label="Gordura" consumed={food.fat} target={targets.fat} color="var(--fat)" />
      </Card>

      <Card>
        <CardTitle>
          Peso do dia <span className="text-[0.78rem] font-medium text-[var(--text-soft)]">(opcional)</span>
        </CardTitle>
        <WeightInput value={log.weight} placeholder="kg" onSave={onSaveWeight} />
        <div className="mb-3 mt-4 font-bold">
          Percentual de gordura do dia <span className="text-[0.78rem] font-medium text-[var(--text-soft)]">(opcional)</span>
        </div>
        <WeightInput value={log.bodyFatPct} placeholder="%" onSave={onSaveBodyFat} />
      </Card>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-[var(--surface)] p-4 shadow-[0_1px_2px_rgba(43,43,51,.06),0_10px_26px_-16px_rgba(43,43,51,.28)]">
      {children}
    </div>
  )
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 font-[Space_Grotesk] font-bold">{children}</div>
}
function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[0.72rem] text-[var(--text-soft)]">
      {children}
    </span>
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
function MacroRow({ label, consumed, target, color }: { label: string; consumed: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between text-[0.85rem]">
        <span className="font-semibold" style={{ color }}>
          {label}
        </span>
        <span>
          {fmtNum(consumed)} / {fmtNum(target)} g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function WeightInput({
  value,
  placeholder,
  onSave,
}: {
  value: number | null
  placeholder: string
  onSave: (v: number) => Promise<{ error: Error | null }>
}) {
  const [input, setInput] = useState(value != null ? String(value) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  async function handleSave() {
    const v = +input
    if (!v || v <= 0) return
    setSaving(true)
    setError(false)
    const { error: saveError } = await onSave(v)
    setSaving(false)
    if (saveError) {
      setError(true)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex gap-2">
      <input
        type="number"
        step={0.1}
        min={0}
        inputMode="decimal"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="flex-1 rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:border-[var(--blue)]"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-[10px] bg-[var(--orange)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando…' : saved ? '✓ Salvo!' : 'Salvar'}
      </button>
      {error && <span className="self-center text-xs text-[var(--coral)]">Erro ao salvar</span>}
    </div>
  )
}
