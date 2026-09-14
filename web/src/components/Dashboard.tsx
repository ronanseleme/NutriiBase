import { useEffect, useState } from 'react'
import { dayFoodTotals, dayWorkoutKcal } from '../lib/calculations'
import {
  computeMonthInsights,
  computeMonthMetricBars,
  computeRangeTotals,
  computeYearMetricBars,
  computeYearMonthlyBars,
} from '../lib/insights'
import { formatShortDate, monthAbbrev, monthLabel, pad, parseISODate, todayISO } from '../lib/dateUtils'
import { useDayLog } from '../hooks/useDayLog'
import { useMonthLogs } from '../hooks/useMonthLogs'
import { useRangeLogs } from '../hooks/useRangeLogs'
import { useYearLogs } from '../hooks/useYearLogs'
import { WeightBodyFatKpi } from './WeightBodyFatKpi'
import { BalanceBarChart, type BalanceBar } from './BalanceBarChart'
import type { ViewMode } from './ViewModeToggle'
import type { DateRange, DayLog, Profile } from '../types'

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
  customRange: DateRange | null
  onSaveWeight: (kg: number) => Promise<{ error: Error | null }>
  onSaveBodyFat: (pct: number) => Promise<{ error: Error | null }>
}

export function Dashboard({ profile, log, userId, dateIso, viewMode, customRange, onSaveWeight, onSaveBodyFat }: Props) {
  const targets = profile.targets
  const selected = parseISODate(dateIso)
  const selY = selected.getFullYear()
  const selM = selected.getMonth() + 1

  const rangeStart = customRange?.start ?? `${selY}-${pad(selM)}-01`
  const rangeEnd = customRange?.end ?? dateIso

  const { rangeMap, reload: reloadRange } = useRangeLogs(userId, rangeStart, rangeEnd)
  useEffect(() => {
    reloadRange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log])
  const mtd = computeRangeTotals(rangeStart, rangeEnd, rangeMap)

  const isMonthly = viewMode === 'monthly'
  const food = isMonthly
    ? { kcal: mtd.kcal, protein: mtd.protein, carbs: mtd.carbs, fat: mtd.fat, grams: mtd.grams }
    : dayFoodTotals(log.meals)
  const burn = isMonthly ? mtd.workoutKcal : dayWorkoutKcal(log.workouts)
  const scaledTmb = isMonthly ? targets.tmb * mtd.days : targets.tmb
  const scaledKcalTarget = isMonthly ? targets.kcal * mtd.days : targets.kcal
  const scaledProteinTarget = isMonthly ? targets.protein * mtd.days : targets.protein
  const scaledCarbTarget = isMonthly ? targets.carb * mtd.days : targets.carb
  const scaledFatTarget = isMonthly ? targets.fat * mtd.days : targets.fat
  const metaAjustada = scaledKcalTarget + burn
  const restante = metaAjustada - food.kcal
  const pct = metaAjustada > 0 ? Math.round((food.kcal / metaAjustada) * 100) : 0
  const periodLabel = customRange
    ? `${formatShortDate(rangeStart)} até ${formatShortDate(rangeEnd)}`
    : `1 a ${selected.getDate()} de ${monthLabel(selY, selM)}`

  const firstName = (profile.name || '').trim().split(/\s+/)[0]
  const greeting =
    firstName && profile.targetWeightKg != null
      ? `Olá, ${firstName} — faltam ${fmtNum(Math.abs(profile.weightKg - profile.targetWeightKg))} kg para sua meta.`
      : firstName
        ? `Olá, ${firstName} — aqui está seu progresso.`
        : 'Aqui está seu progresso.'

  // Sinal do dia: sempre reflete o dia de HOJE (independente de qual dia/mês
  // o usuário esteja navegando no restante do painel) — é um status fixo,
  // "você está indo bem hoje ou não", parecido com um placar diário.
  const { log: todayLog } = useDayLog(userId, todayISO())
  const todayFood = dayFoodTotals(todayLog.meals)
  const todayBurn = dayWorkoutKcal(todayLog.workouts)
  const todayMetaAjustada = targets.kcal + todayBurn
  const todayRestante = todayMetaAjustada - todayFood.kcal
  const goalSignal =
    todayFood.kcal === 0
      ? { icon: '📝', color: 'var(--text-soft)', text: 'você ainda não registrou nada hoje.' }
      : todayRestante >= 0
        ? { icon: '✅', color: 'var(--teal)', text: `você está dentro da meta de hoje — faltam ${fmtNum(todayRestante)} kcal.` }
        : { icon: '⚠️', color: 'var(--coral)', text: `você já passou ${fmtNum(Math.abs(todayRestante))} kcal da meta de hoje.` }

  return (
    <div className="flex flex-col gap-4">
      <div className="px-1">
        <p className="text-[0.95rem] font-semibold text-[var(--text)]">{greeting}</p>
        <p className="mt-1 text-[0.85rem] font-semibold" style={{ color: goalSignal.color }}>
          {goalSignal.icon} {goalSignal.text}
        </p>
      </div>

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
          {isMonthly && ` · acumulado de ${periodLabel}`}
        </p>
        {isMonthly && (
          <p className="mt-1 text-center text-[0.78rem] text-[var(--text-soft)]">
            Peso mais recente no período: <b>{fmtNum(mtd.lastWeight ?? profile.weightKg)} kg</b>
          </p>
        )}
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
        <CardTitle>Peso e composição corporal</CardTitle>
        <WeightBodyFatKpi profile={profile} />
      </Card>

      <Card>
        <CardTitle>Saldo calórico</CardTitle>
        <CalorieBalanceChart userId={userId} profile={profile} />
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <div className="mb-2 text-[0.85rem] font-bold">
              Peso do dia <span className="text-[0.72rem] font-medium text-[var(--text-soft)]">(opcional)</span>
            </div>
            <WeightInput value={log.weight} placeholder="kg" onSave={onSaveWeight} />
          </div>
          <div className="min-w-0">
            <div className="mb-2 text-[0.85rem] font-bold">
              % gordura dia <span className="text-[0.72rem] font-medium text-[var(--text-soft)]">(opcional)</span>
            </div>
            <WeightInput value={log.bodyFatPct} placeholder="%" onSave={onSaveBodyFat} />
          </div>
        </div>
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
type ChartMetric = 'saldo' | 'food' | 'workout'

const METRIC_TABS: { key: ChartMetric; label: string }[] = [
  { key: 'saldo', label: 'Saldo' },
  { key: 'food', label: 'Alimentação' },
  { key: 'workout', label: 'Treino' },
]

function CalorieBalanceChart({ userId, profile }: { userId: string | null; profile: Profile }) {
  const [metric, setMetric] = useState<ChartMetric>('saldo')
  const [mode, setMode] = useState<ChartMode>('daily')
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const year = now.getFullYear()

  const { monthMap } = useMonthLogs(userId, ym.y, ym.m)
  const { yearMap } = useYearLogs(userId, year)

  const monthInfo = computeMonthInsights(ym.y, ym.m, profile, monthMap)
  const yearBars = computeYearMonthlyBars(year, yearMap, profile.targets.kcal)
  const foodMonthBars = computeMonthMetricBars(ym.y, ym.m, monthMap, 'kcal')
  const workoutMonthBars = computeMonthMetricBars(ym.y, ym.m, monthMap, 'workoutKcal')
  const foodYearBars = computeYearMetricBars(year, yearMap, 'kcal')
  const workoutYearBars = computeYearMetricBars(year, yearMap, 'workoutKcal')

  const labelEvery = Math.max(1, Math.ceil(monthInfo.bars.length / 8))

  const saldoDailyBars: BalanceBar[] = monthInfo.bars.map((b, i) => ({
    key: b.day,
    label: i % labelEvery === 0 || i === monthInfo.bars.length - 1 ? String(b.day) : '',
    saldo: b.saldo,
    title: b.saldo != null ? `Dia ${b.day}: ${fmtSigned(b.saldo)} kcal vs. meta` : `Dia ${b.day}: sem dado`,
  }))
  const saldoMonthlyBars: BalanceBar[] = yearBars.map((b) => ({
    key: b.month,
    label: monthAbbrev(b.month),
    saldo: b.saldo,
    title:
      b.saldo != null
        ? `${monthAbbrev(b.month)}: ${fmtSigned(b.saldo)} kcal vs. meta (${b.trackedDays} dia(s) com registro)`
        : `${monthAbbrev(b.month)}: sem dado`,
  }))
  const foodDailyBars: BalanceBar[] = foodMonthBars.map((b, i) => ({
    key: b.day,
    label: i % labelEvery === 0 || i === foodMonthBars.length - 1 ? String(b.day) : '',
    saldo: b.value,
    title: b.value != null ? `Dia ${b.day}: ${fmtNum(b.value)} kcal consumidos` : `Dia ${b.day}: sem dado`,
  }))
  const workoutDailyBars: BalanceBar[] = workoutMonthBars.map((b, i) => ({
    key: b.day,
    label: i % labelEvery === 0 || i === workoutMonthBars.length - 1 ? String(b.day) : '',
    saldo: b.value,
    title: b.value != null ? `Dia ${b.day}: ${fmtNum(b.value)} kcal de treino` : `Dia ${b.day}: sem dado`,
  }))
  const foodMonthlyBars: BalanceBar[] = foodYearBars.map((b) => ({
    key: b.month,
    label: monthAbbrev(b.month),
    saldo: b.value,
    title:
      b.value != null
        ? `${monthAbbrev(b.month)}: ${fmtNum(b.value)} kcal consumidos (${b.trackedDays} dia(s) com registro)`
        : `${monthAbbrev(b.month)}: sem dado`,
  }))
  const workoutMonthlyBars: BalanceBar[] = workoutYearBars.map((b) => ({
    key: b.month,
    label: monthAbbrev(b.month),
    saldo: b.value,
    title:
      b.value != null
        ? `${monthAbbrev(b.month)}: ${fmtNum(b.value)} kcal de treino (${b.trackedDays} dia(s) com registro)`
        : `${monthAbbrev(b.month)}: sem dado`,
  }))

  const dailyBars = metric === 'saldo' ? saldoDailyBars : metric === 'food' ? foodDailyBars : workoutDailyBars
  const monthlyBars = metric === 'saldo' ? saldoMonthlyBars : metric === 'food' ? foodMonthlyBars : workoutMonthlyBars
  const barColor = metric === 'food' ? 'var(--orange)' : metric === 'workout' ? 'var(--teal)' : undefined
  const legend =
    metric === 'saldo' ? (
      <p className="mt-3 text-[0.78rem] text-[var(--text-soft)]">
        Verde = déficit (abaixo da meta) · Vermelho = superávit (acima da meta).
      </p>
    ) : metric === 'food' ? (
      <p className="mt-3 text-[0.78rem] text-[var(--text-soft)]">Total de kcal consumidos por dia/mês.</p>
    ) : (
      <p className="mt-3 text-[0.78rem] text-[var(--text-soft)]">Total de kcal queimados em treino por dia/mês.</p>
    )

  function prevMonth() {
    setYm((cur) => (cur.m === 1 ? { y: cur.y - 1, m: 12 } : { y: cur.y, m: cur.m - 1 }))
  }
  function nextMonth() {
    setYm((cur) => (cur.m === 12 ? { y: cur.y + 1, m: 1 } : { y: cur.y, m: cur.m + 1 }))
  }

  return (
    <div>
      <div className="nb-segmented mb-2.5">
        {METRIC_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMetric(t.key)}
            className={`flex-1 py-1.5 text-[0.78rem] font-semibold transition-colors ${metric === t.key ? 'bg-[image:var(--blue-gradient)] text-white' : 'bg-[var(--surface)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
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
          <BalanceBarChart bars={dailyBars} barColor={barColor} />
        </>
      ) : (
        <>
          <div className="mb-2 text-center text-[0.82rem] font-bold">{year}</div>
          <BalanceBarChart bars={monthlyBars} barColor={barColor} />
        </>
      )}
      {legend}
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
    <div>
      <div className="flex gap-1.5">
        <input
          type="number"
          step={0.1}
          min={0}
          inputMode="decimal"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="nb-input min-w-0 flex-1 px-2.5"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="nb-btn nb-btn-primary shrink-0 px-3 py-2.5 text-[0.8rem]"
        >
          {saving ? '…' : saved ? '✓' : 'Salvar'}
        </button>
      </div>
      {error && <span className="mt-1 block text-xs text-[var(--coral)]">Erro ao salvar</span>}
    </div>
  )
}
