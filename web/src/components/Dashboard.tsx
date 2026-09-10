import { useEffect, useState } from 'react'
import { ACTIVITY, GOALS, PACES } from '../lib/constants'
import { dayFoodTotals, dayWorkoutKcal } from '../lib/calculations'
import { computeMonthInsights, computeMonthToDate, computeYearMonthlyBars } from '../lib/insights'
import { monthAbbrev, monthLabel, parseISODate } from '../lib/dateUtils'
import { useMonthLogs } from '../hooks/useMonthLogs'
import { useYearLogs } from '../hooks/useYearLogs'
import { WeightBodyFatKpi } from './WeightBodyFatKpi'
import { BalanceBarChart, type BalanceBar } from './BalanceBarChart'
import { RoleBadge } from './RoleBadge'
import type { ViewMode } from './ViewModeToggle'
import type { DayLog, Profile } from '../types'

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
function fmtSigned(n: number): string {
  return (n >= 0 ? '+' : '') + fmtNum(n)
}
interface Props {
  profile: Profile
  log: DayLog
  userId: string | null
  dateIso: string
  viewMode: ViewMode
  onEditProfile: () => void
  onSaveWeight: (kg: number) => Promise<{ error: Error | null }>
  onSaveBodyFat: (pct: number) => Promise<{ error: Error | null }>
}

export function Dashboard({ profile, log, userId, dateIso, viewMode, onEditProfile, onSaveWeight, onSaveBodyFat }: Props) {
  const targets = profile.targets
  const selected = parseISODate(dateIso)
  const selY = selected.getFullYear()
  const selM = selected.getMonth() + 1
  const selDay = selected.getDate()

  const { monthMap: mtdMonthMap, reload: reloadMtdMonth } = useMonthLogs(userId, selY, selM)
  useEffect(() => {
    reloadMtdMonth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log])
  const mtd = computeMonthToDate(selY, selM, selDay, mtdMonthMap)

  const isMonthly = viewMode === 'monthly'
  const food = isMonthly
    ? { kcal: mtd.kcal, protein: mtd.protein, carbs: mtd.carbs, fat: mtd.fat, grams: mtd.grams }
    : dayFoodTotals(log.meals)
  const burn = isMonthly ? mtd.workoutKcal : dayWorkoutKcal(log.workouts)
  const scaledTmb = isMonthly ? targets.tmb * selDay : targets.tmb
  const scaledKcalTarget = isMonthly ? targets.kcal * selDay : targets.kcal
  const scaledProteinTarget = isMonthly ? targets.protein * selDay : targets.protein
  const scaledCarbTarget = isMonthly ? targets.carb * selDay : targets.carb
  const scaledFatTarget = isMonthly ? targets.fat * selDay : targets.fat
  const metaAjustada = scaledKcalTarget + burn
  const restante = metaAjustada - food.kcal
  const pct = metaAjustada > 0 ? Math.round((food.kcal / metaAjustada) * 100) : 0

  const initials =
    profile.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || '?'
  const activityLabel = ACTIVITY.find((a) => a.key === profile.activity)?.label || profile.activity
  const goalLabel = GOALS.find((g) => g.key === profile.goal)?.label || profile.goal
  const paceLabel = PACES.find((p) => p.key === profile.pace)?.label || profile.pace
  const restrictionsNote = profile.restrictions?.note?.trim()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate font-[Space_Grotesk] font-bold">{profile.name || 'Sem nome'}</div>
              <div className="mt-1">
                <RoleBadge role={profile.role} />
              </div>
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
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>{profile.age} anos</Chip>
          <Chip>{profile.sex === 'M' ? 'Masculino' : 'Feminino'}</Chip>
          <Chip>
            peso <b>{profile.weightKg} kg</b>
          </Chip>
          <Chip>{profile.heightCm} cm</Chip>
          {profile.bodyFatPct != null && (
            <Chip>
              gordura <b>{profile.bodyFatPct}%</b>
            </Chip>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Chip title="Taxa metabólica basal — o que seu corpo gasta parado, em repouso">
            TMB <b>{targets.tmb} kcal</b> parado
          </Chip>
          <Chip title="Gasto Energético Total — TMB ajustada pelo seu nível de atividade">
            GET <b>{targets.get} kcal</b> ativo
          </Chip>
          <Chip>{activityLabel}</Chip>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Chip>{goalLabel}</Chip>
          <Chip>ritmo {paceLabel.toLowerCase()}</Chip>
          {profile.targetWeightKg != null && (
            <Chip>
              meta <b>{profile.targetWeightKg} kg</b>
              {profile.targetDate ? ` até ${new Intl.DateTimeFormat('pt-BR').format(parseISODate(profile.targetDate))}` : ''}
            </Chip>
          )}
        </div>
        {restrictionsNote && (
          <p className="mt-2 text-[0.76rem] text-[var(--text-soft)]">
            <b className="text-[var(--text)]">Restrições:</b> {restrictionsNote}
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Peso e composição corporal</CardTitle>
        <WeightBodyFatKpi profile={profile} />
      </Card>

      <Card>
        <CardTitle>{isMonthly ? 'Balanço do mês' : 'Balanço do dia'}</CardTitle>
        <div className="grid grid-cols-4 gap-1">
          <StatRing
            label="Meta"
            value={fmtNum(scaledKcalTarget)}
            sublabel="kcal"
            fillPct={metaAjustada > 0 ? scaledKcalTarget / metaAjustada : 0}
            color="var(--blue)"
          />
          <StatRing
            label="Gasto total"
            value={fmtNum(scaledTmb + burn)}
            sublabel="kcal"
            fillPct={metaAjustada > 0 ? (scaledTmb + burn) / metaAjustada : 0}
            color="var(--teal)"
          />
          <StatRing label="Consumo" value={fmtNum(food.kcal)} sublabel="kcal" fillPct={pct / 100} color="var(--orange)" />
          <StatRing
            label="Saldo"
            value={fmtSigned(restante)}
            sublabel="kcal"
            fillPct={metaAjustada > 0 ? Math.abs(restante) / metaAjustada : 0}
            color={restante < 0 ? 'var(--coral)' : 'var(--teal)'}
          />
        </div>
        <p className="mt-3 text-center text-[0.78rem] text-[var(--text-soft)]">
          {pct}% da meta ajustada de <b>{fmtNum(metaAjustada)} kcal</b>
          {isMonthly && ` · acumulado de 1 a ${selDay} de ${monthLabel(selY, selM)}`}
        </p>
        {isMonthly && (
          <p className="mt-1 text-center text-[0.78rem] text-[var(--text-soft)]">
            Peso mais recente no período: <b>{fmtNum(mtd.lastWeight ?? profile.weightKg)} kg</b>
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Saldo calórico</CardTitle>
        <CalorieBalanceChart userId={userId} profile={profile} />
        <p className="mt-3 text-[0.78rem] text-[var(--text-soft)]">
          Verde = déficit (abaixo da meta) · Vermelho = superávit (acima da meta).
        </p>
      </Card>

      <Card>
        <CardTitle>{isMonthly ? 'Macros do mês' : 'Macros do dia'}</CardTitle>
        <div className="grid grid-cols-4 gap-1">
          <MacroRing label="Proteínas" consumed={food.protein} target={scaledProteinTarget} color="var(--protein)" />
          <MacroRing label="Carboidratos" consumed={food.carbs} target={scaledCarbTarget} color="var(--carb)" />
          <MacroRing label="Gordura" consumed={food.fat} target={scaledFatTarget} color="var(--fat)" />
          <MacroRing label="Gramas" consumed={food.grams} target={null} color="var(--orange-light)" />
        </div>
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
  return <div className="nb-card">{children}</div>
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div className="nb-card-title">{children}</div>
}
function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[0.72rem] text-[var(--text-soft)]">
      {children}
    </span>
  )
}
function StatRing({
  label,
  value,
  sublabel,
  fillPct,
  color,
}: {
  label: string
  value: string
  sublabel: string
  fillPct: number
  color: string
}) {
  const size = 76
  const stroke = 7
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(1, fillPct)) * circumference

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            style={{ stroke: `color-mix(in srgb, ${color} 18%, transparent)` }}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ stroke: color }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[1.05rem] font-extrabold leading-none text-[var(--text)]">{value}</span>
          <span className="mt-0.5 text-[0.58rem] leading-none text-[var(--text-soft)]">{sublabel}</span>
        </div>
      </div>
      <span className="text-center text-[0.68rem] font-semibold text-[var(--text-soft)]">{label}</span>
    </div>
  )
}
function MacroRing({
  label,
  consumed,
  target,
  color,
}: {
  label: string
  consumed: number
  target: number | null
  color: string
}) {
  return (
    <StatRing
      label={label}
      value={fmtNum(consumed)}
      sublabel={target != null ? `/${fmtNum(target)}g` : 'g'}
      fillPct={target != null && target > 0 ? consumed / target : 0}
      color={color}
    />
  )
}

type ChartMode = 'daily' | 'monthly'

function CalorieBalanceChart({ userId, profile }: { userId: string | null; profile: Profile }) {
  const [mode, setMode] = useState<ChartMode>('daily')
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const year = now.getFullYear()

  const { monthMap } = useMonthLogs(userId, ym.y, ym.m)
  const { yearMap } = useYearLogs(userId, year)

  const monthInfo = computeMonthInsights(ym.y, ym.m, profile, monthMap)
  const yearBars = computeYearMonthlyBars(year, yearMap, profile.targets.kcal)

  const labelEvery = Math.max(1, Math.ceil(monthInfo.bars.length / 8))
  const dailyBars: BalanceBar[] = monthInfo.bars.map((b, i) => ({
    key: b.day,
    label: i % labelEvery === 0 || i === monthInfo.bars.length - 1 ? String(b.day) : '',
    saldo: b.saldo,
    title: b.saldo != null ? `Dia ${b.day}: ${fmtSigned(b.saldo)} kcal vs. meta` : `Dia ${b.day}: sem dado`,
  }))
  const monthlyBars: BalanceBar[] = yearBars.map((b) => ({
    key: b.month,
    label: monthAbbrev(b.month),
    saldo: b.saldo,
    title:
      b.saldo != null
        ? `${monthAbbrev(b.month)}: ${fmtSigned(b.saldo)} kcal vs. meta (${b.trackedDays} dia(s) com registro)`
        : `${monthAbbrev(b.month)}: sem dado`,
  }))

  function prevMonth() {
    setYm((cur) => (cur.m === 1 ? { y: cur.y - 1, m: 12 } : { y: cur.y, m: cur.m - 1 }))
  }
  function nextMonth() {
    setYm((cur) => (cur.m === 12 ? { y: cur.y + 1, m: 1 } : { y: cur.y, m: cur.m + 1 }))
  }

  return (
    <div>
      <div className="nb-segmented mb-3">
        <button
          type="button"
          onClick={() => setMode('daily')}
          className={`flex-1 py-1.5 text-[0.8rem] font-semibold transition-colors ${mode === 'daily' ? 'bg-[image:var(--blue-gradient)] text-white' : 'bg-[var(--surface)]'}`}
        >
          Diária
        </button>
        <button
          type="button"
          onClick={() => setMode('monthly')}
          className={`flex-1 py-1.5 text-[0.8rem] font-semibold transition-colors ${mode === 'monthly' ? 'bg-[image:var(--blue-gradient)] text-white' : 'bg-[var(--surface)]'}`}
        >
          Mensal
        </button>
      </div>

      {mode === 'daily' ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Mês anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold"
            >
              ‹
            </button>
            <span className="text-[0.82rem] font-bold">{monthLabel(ym.y, ym.m)}</span>
            <button
              type="button"
              onClick={nextMonth}
              disabled={monthInfo.isCurrentMonth}
              aria-label="Próximo mês"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <BalanceBarChart bars={dailyBars} />
        </>
      ) : (
        <>
          <div className="mb-2 text-center text-[0.82rem] font-bold">{year}</div>
          <BalanceBarChart bars={monthlyBars} />
        </>
      )}
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
        className="nb-input flex-1"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="nb-btn nb-btn-primary px-4 py-2.5 text-sm"
      >
        {saving ? 'Salvando…' : saved ? '✓ Salvo!' : 'Salvar'}
      </button>
      {error && <span className="self-center text-xs text-[var(--coral)]">Erro ao salvar</span>}
    </div>
  )
}
