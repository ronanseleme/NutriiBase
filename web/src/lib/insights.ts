import { addDays, pad, parseISODate, todayISO, toISODate } from './dateUtils'
import type { RefeicaoRow, RegistroPesoRow, TreinoRow } from './mappers'
import type { Profile } from '../types'

export interface DayInsightData {
  kcal: number
  protein: number
  carbs: number
  fat: number
  grams: number
  workoutKcal: number
  workoutCount: number
  weight: number | null
}

export function buildDayMap(
  refeicoes: RefeicaoRow[],
  treinos: TreinoRow[],
  pesos: RegistroPesoRow[],
): Record<string, DayInsightData> {
  const map: Record<string, DayInsightData> = {}
  function ensure(iso: string): DayInsightData {
    if (!map[iso]) map[iso] = { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0, workoutKcal: 0, workoutCount: 0, weight: null }
    return map[iso]
  }
  refeicoes.forEach((r) => {
    const d = ensure(r.data)
    d.kcal += r.kcal
    d.protein += r.proteina_g
    d.carbs += r.carboidrato_g
    d.fat += r.gordura_g
    d.grams += r.porcao || 0
  })
  treinos.forEach((w) => {
    const d = ensure(w.data)
    d.workoutKcal += w.kcal_estimado
    d.workoutCount += 1
  })
  pesos.forEach((p) => {
    if (p.peso_kg != null) ensure(p.data).weight = p.peso_kg
  })
  return map
}

function hasData(d: DayInsightData | undefined): boolean {
  return !!d && (d.kcal > 0 || d.workoutKcal > 0 || d.weight != null)
}

export function computeStreak(map: Record<string, DayInsightData>): number {
  let streak = 0
  let cursor = new Date()
  for (let i = 0; i < 365; i++) {
    const iso = toISODate(cursor)
    if (hasData(map[iso])) {
      streak++
      cursor = addDays(cursor, -1)
    } else {
      break
    }
  }
  return streak
}

export interface InsightTip {
  icon: string
  title: string
  text: string
}

export function computeInsightTips(profile: Profile, recentMap: Record<string, DayInsightData>): InsightTip[] {
  const t = profile.targets
  const tips: InsightTip[] = []
  const todayIso = todayISO()

  const weightDates = Object.keys(recentMap)
    .filter((k) => recentMap[k].weight != null)
    .sort()
  const lastWeightIso = weightDates[weightDates.length - 1]
  const daysSinceWeight = lastWeightIso
    ? Math.round((parseISODate(todayIso).getTime() - parseISODate(lastWeightIso).getTime()) / 86400000)
    : null
  if (daysSinceWeight === null) {
    tips.push({
      icon: '⚖️',
      title: 'Registre seu peso',
      text: 'Você ainda não registrou nenhum peso. Um registro semanal já é suficiente para acompanhar a tendência.',
    })
  } else if (daysSinceWeight >= 4) {
    tips.push({
      icon: '⚖️',
      title: 'Peso desatualizado',
      text: `Faz ${daysSinceWeight} dias desde o último registro de peso. Registre hoje para manter a tendência confiável.`,
    })
  }

  let last7Workouts = 0
  for (let i = 0; i < 7; i++) {
    const iso = toISODate(addDays(new Date(), -i))
    if (recentMap[iso] && recentMap[iso].workoutKcal > 0) last7Workouts++
  }
  if (last7Workouts === 0) {
    tips.push({
      icon: '🏃',
      title: 'Nenhum treino recente',
      text: 'Sem treinos registrados nos últimos 7 dias. Se você treinou, registrar ajuda a meta a refletir seu gasto real.',
    })
  }

  if (profile.targetWeightKg) {
    const delta = profile.weightKg - profile.targetWeightKg
    if (Math.abs(delta) < 0.3) {
      tips.push({
        icon: '🎯',
        title: 'Perto da meta de peso',
        text: `Você está a menos de 300 g do seu peso-meta de ${profile.targetWeightKg} kg.`,
      })
    } else if (profile.targetDate) {
      const daysLeft = Math.round(
        (parseISODate(profile.targetDate).getTime() - parseISODate(todayIso).getTime()) / 86400000,
      )
      if (daysLeft > 0) {
        const weeklyRate = Math.abs(delta) / (daysLeft / 7)
        if (weeklyRate > 1) {
          tips.push({
            icon: '⚠️',
            title: 'Ritmo agressivo para a data-meta',
            text: `Para chegar a ${profile.targetWeightKg} kg até a data-meta faltam ${daysLeft} dias, exigindo cerca de ${weeklyRate.toFixed(1)} kg/semana — acima do recomendado (até ~1 kg/semana). Considere adiar a data ou ajustar a meta.`,
          })
        } else {
          tips.push({
            icon: '📈',
            title: 'No caminho para a meta',
            text: `Faltam ${Math.abs(delta).toFixed(1)} kg em ${daysLeft} dias — um ritmo de ~${weeklyRate.toFixed(2)} kg/semana, dentro do razoável.`,
          })
        }
      }
    }
  }

  const proteinRatios: number[] = []
  for (let j = 1; j <= 7; j++) {
    const iso = toISODate(addDays(new Date(), -j))
    const d = recentMap[iso]
    if (d && d.kcal > 0) proteinRatios.push(d.protein / t.protein)
  }
  if (proteinRatios.length >= 3) {
    const avgRatio = proteinRatios.reduce((a, b) => a + b, 0) / proteinRatios.length
    if (avgRatio < 0.85) {
      tips.push({
        icon: '🥩',
        title: 'Proteína abaixo da meta',
        text: `Na última semana sua proteína ficou em média em ${Math.round(avgRatio * 100)}% da meta. Priorize uma fonte de proteína em cada refeição.`,
      })
    }
  }

  if (t.safety && (t.safety.belowFloor || t.safety.belowTMB)) {
    tips.push({
      icon: '⚠️',
      title: 'Meta calórica no limite',
      text: 'Sua meta atual está no mínimo seguro (ou abaixo da TMB). Considere um ritmo mais lento para emagrecimento sustentável.',
    })
  }

  const streak = computeStreak(recentMap)
  if (streak >= 7) {
    tips.push({
      icon: '🔥',
      title: 'Boa consistência',
      text: `Você já registra há ${streak} dias seguidos — é o que mais impacta resultado a longo prazo.`,
    })
  } else if (streak === 0) {
    tips.push({
      icon: '📝',
      title: 'Comece hoje',
      text: 'Você ainda não registrou nada hoje. Um registro rápido já ajuda a manter a régua.',
    })
  }

  const generalPool = [
    'Distribua a proteína em 3–4 refeições ao longo do dia para melhor aproveitamento na síntese muscular.',
    'Beba água regularmente, principalmente em dias de treino mais intenso.',
    'Priorize alimentos minimamente processados na maior parte das refeições.',
    'Durma de 7 a 9 horas — o sono afeta diretamente a recuperação e a fome do dia seguinte.',
    'Carboidratos perto do treino ajudam performance e recuperação, especialmente em treinos intensos.',
  ]
  const dayIdx = Math.floor(Date.now() / 86400000) % generalPool.length
  tips.push({ icon: '💡', title: 'Dica', text: generalPool[dayIdx] })

  return tips.slice(0, 5)
}

export interface RecentBar {
  iso: string
  day: number
  saldo: number | null
}

/** Saldo calórico (consumo - meta ajustada pelo exercício) dos últimos `days` dias, hoje incluso. */
export function computeRecentBars(
  recentMap: Record<string, DayInsightData>,
  targetKcal: number,
  days = 14,
): RecentBar[] {
  const bars: RecentBar[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(new Date(), -i)
    const iso = toISODate(d)
    const data = recentMap[iso]
    const hasDayData = data && (data.kcal > 0 || data.workoutKcal > 0 || data.weight != null)
    bars.push({
      iso,
      day: d.getDate(),
      saldo: hasDayData ? data.kcal - (targetKcal + data.workoutKcal) : null,
    })
  }
  return bars
}

export interface MonthBar {
  day: number
  saldo: number | null
}

export interface MonthInsights {
  bars: MonthBar[]
  trackedCount: number
  saldoAcumulado: number
  metaMensalSaldo: number
  diasRestantes: number
  isCurrentMonth: boolean
  pesoInicio: number
  pesoAtual: number
  pesoMeta: number | null
}

export function computeMonthInsights(
  y: number,
  m: number,
  profile: Profile,
  monthMap: Record<string, DayInsightData>,
): MonthInsights {
  const t = profile.targets
  const dim = new Date(y, m, 0).getDate()
  const today = new Date()
  const isCurrentMonth = y === today.getFullYear() && m === today.getMonth() + 1
  const lastDay = isCurrentMonth ? today.getDate() : dim

  const bars: MonthBar[] = []
  const tracked: number[] = []
  const weightsInMonth: { d: number; w: number }[] = []
  for (let d = 1; d <= dim; d++) {
    const iso = `${y}-${pad(m)}-${pad(d)}`
    const dayData = monthMap[iso]
    if (dayData && dayData.weight != null) weightsInMonth.push({ d, w: dayData.weight })
    if (dayData && hasData(dayData) && d <= lastDay) {
      const saldo = dayData.kcal - (t.kcal + dayData.workoutKcal)
      bars.push({ day: d, saldo })
      tracked.push(saldo)
    } else {
      bars.push({ day: d, saldo: null })
    }
  }
  const saldoAcumulado = tracked.reduce((s, v) => s + v, 0)
  const metaMensalSaldo = Math.round((t.kcal - t.get) * dim)
  const diasRestantes = isCurrentMonth ? Math.max(0, dim - lastDay) : 0

  const pesoInicio = weightsInMonth.length ? weightsInMonth[0].w : profile.weightKg
  const pesoAtual = weightsInMonth.length ? weightsInMonth[weightsInMonth.length - 1].w : profile.weightKg

  return {
    bars,
    trackedCount: tracked.length,
    saldoAcumulado,
    metaMensalSaldo,
    diasRestantes,
    isCurrentMonth,
    pesoInicio,
    pesoAtual,
    pesoMeta: profile.targetWeightKg,
  }
}

export interface YearMonthBar {
  month: number // 1-12
  saldo: number | null // soma do saldo dos dias com registro no mês; null = nenhum dia com dado
  trackedDays: number
}

/** Saldo calórico agregado por mês (soma dos saldos diários) para o ano inteiro. */
export function computeYearMonthlyBars(
  year: number,
  yearMap: Record<string, DayInsightData>,
  targetKcal: number,
): YearMonthBar[] {
  const bars: YearMonthBar[] = []
  for (let m = 1; m <= 12; m++) {
    const dim = new Date(year, m, 0).getDate()
    let total = 0
    let tracked = 0
    for (let d = 1; d <= dim; d++) {
      const iso = `${year}-${pad(m)}-${pad(d)}`
      const dayData = yearMap[iso]
      if (dayData && hasData(dayData)) {
        total += dayData.kcal - (targetKcal + dayData.workoutKcal)
        tracked++
      }
    }
    bars.push({ month: m, saldo: tracked > 0 ? total : null, trackedDays: tracked })
  }
  return bars
}

export interface MonthToDateTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  grams: number
  workoutKcal: number
  workoutCount: number
  diasElapsed: number
  lastWeight: number | null
}

/** Acumulado do dia 1 do mês até `day` (inclusive) — usado pela visão Mensal. */
export function computeMonthToDate(
  y: number,
  m: number,
  day: number,
  monthMap: Record<string, DayInsightData>,
): MonthToDateTotals {
  const totals: MonthToDateTotals = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    grams: 0,
    workoutKcal: 0,
    workoutCount: 0,
    diasElapsed: day,
    lastWeight: null,
  }
  for (let d = 1; d <= day; d++) {
    const dd = monthMap[`${y}-${pad(m)}-${pad(d)}`]
    if (!dd) continue
    totals.kcal += dd.kcal
    totals.protein += dd.protein
    totals.carbs += dd.carbs
    totals.fat += dd.fat
    totals.grams += dd.grams
    totals.workoutKcal += dd.workoutKcal
    totals.workoutCount += dd.workoutCount
    if (dd.weight != null) totals.lastWeight = dd.weight
  }
  return totals
}
