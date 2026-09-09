import { ACTIVITY, DEFICIT_KCAL, MEALS, SURPLUS_PCT } from './constants'
import { parseISODate, todayISO } from './dateUtils'
import type { DayLog, FoodItem, MealsByKey, Profile, Targets, Workout } from '../types'

export function leanMassKg(p: Pick<Profile, 'bodyFatPct' | 'weightKg'>): number | null {
  if (p.bodyFatPct != null && p.bodyFatPct > 0 && p.bodyFatPct < 70) {
    return p.weightKg * (1 - p.bodyFatPct / 100)
  }
  return null
}

type ProfileForTargets = Pick<
  Profile,
  | 'bodyFatPct'
  | 'weightKg'
  | 'sex'
  | 'heightCm'
  | 'age'
  | 'activity'
  | 'goal'
  | 'pace'
  | 'targetWeightKg'
  | 'bodyFatTargetPct'
  | 'targetDate'
  | 'macroOverride'
>

export function computeTargets(p: ProfileForTargets): Targets {
  const lbm = leanMassKg(p)
  const tmb = lbm != null
    ? 370 + 21.6 * lbm
    : p.sex === 'M'
      ? 66 + 13.7 * p.weightKg + 5 * p.heightCm - 6.8 * p.age
      : 655 + 9.6 * p.weightKg + 1.8 * p.heightCm - 4.7 * p.age

  const activityEntry = ACTIVITY.find((a) => a.key === p.activity) ?? ACTIVITY.find((a) => a.key === 'moderado')!
  const act = activityEntry.factor
  const get = tmb * act
  const safety = { belowFloor: false, belowTMB: false }
  let kcal: number
  let adjustmentLabel = ''
  let usingGoalBased = false
  const floor = p.sex === 'M' ? 1500 : 1200

  let goalDailyAdjustment: number | null = null
  if (p.goal !== 'manutencao' && p.targetWeightKg && p.bodyFatTargetPct != null && p.bodyFatPct != null && p.targetDate) {
    const daysLeft = Math.round((parseISODate(p.targetDate).getTime() - parseISODate(todayISO()).getTime()) / 86400000)
    if (daysLeft > 0) {
      const currentFatMass = p.weightKg * (p.bodyFatPct / 100)
      const targetFatMass = p.targetWeightKg * (p.bodyFatTargetPct / 100)
      const fatChangeKg = targetFatMass - currentFatMass
      goalDailyAdjustment = (fatChangeKg * 7700) / daysLeft
    }
  }

  if (p.goal === 'manutencao') {
    kcal = get
    adjustmentLabel = 'Sem ajuste — meta de manutenção'
  } else if (goalDailyAdjustment != null) {
    usingGoalBased = true
    const rawGoal = get + goalDailyAdjustment
    if (rawGoal < floor) {
      safety.belowFloor = true
      kcal = floor
    } else {
      kcal = rawGoal
    }
    if (kcal < tmb) safety.belowTMB = true
    adjustmentLabel =
      (goalDailyAdjustment >= 0 ? 'Superávit' : 'Déficit') +
      ' de ' +
      Math.abs(Math.round(goalDailyAdjustment)) +
      ' kcal/dia — calculado a partir da sua meta de ' +
      p.targetWeightKg +
      ' kg e ' +
      p.bodyFatTargetPct +
      '% de gordura até ' +
      new Intl.DateTimeFormat('pt-BR').format(parseISODate(p.targetDate!)) +
      (safety.belowFloor ? ' (ajustado ao mínimo seguro)' : '')
  } else if (p.goal === 'emagrecimento') {
    const deficitKcal = DEFICIT_KCAL[p.pace] || 500
    const raw = get - deficitKcal
    if (raw < floor) {
      safety.belowFloor = true
      kcal = floor
      adjustmentLabel = 'Déficit ajustado ao mínimo seguro'
    } else {
      kcal = raw
      adjustmentLabel = `Déficit de ${deficitKcal} kcal/dia (ritmo ${p.pace}) — defina peso-meta, % de gordura-meta e data-meta para um cálculo personalizado`
    }
    if (kcal < tmb) safety.belowTMB = true
  } else {
    const pct2 = SURPLUS_PCT[p.pace] || 0.1
    kcal = get * (1 + pct2)
    adjustmentLabel = `Superávit de ${Math.round(pct2 * 100)}% (ritmo ${p.pace}) — defina peso-meta, % de gordura-meta e data-meta para um cálculo personalizado`
  }

  kcal = Math.round(kcal)
  const adjustmentKcal = kcal - Math.round(get)
  const proteinBaseKg = lbm != null ? lbm : p.weightKg
  const proteinPerKg = p.goal === 'emagrecimento' ? 2.0 : 1.8
  const fatPerKg = 0.9
  const protein = p.macroOverride?.proteinG != null ? p.macroOverride.proteinG : Math.round(proteinPerKg * proteinBaseKg)
  const fat = p.macroOverride?.fatG != null ? p.macroOverride.fatG : Math.round(fatPerKg * p.weightKg)
  const carb = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))

  return {
    tmb: Math.round(tmb),
    get: Math.round(get),
    kcal,
    protein,
    fat,
    carb,
    safety,
    usingLBM: lbm != null,
    leanMassKg: lbm != null ? Math.round(lbm * 10) / 10 : null,
    usingGoalBased,
    activityFactor: act,
    activityLabel: activityEntry.label,
    adjustmentKcal,
    adjustmentLabel,
    proteinPerKg,
    proteinBaseKg: Math.round(proteinBaseKg * 10) / 10,
    fatPerKg,
  }
}

export function suggestedMacros(p: Pick<Profile, 'bodyFatPct' | 'weightKg' | 'goal'>) {
  const lbm = leanMassKg(p)
  const proteinBaseKg = lbm != null ? lbm : p.weightKg
  const proteinPerKg = p.goal === 'emagrecimento' ? 2.0 : 1.8
  return { proteinG: Math.round(proteinPerKg * proteinBaseKg), fatG: Math.round(0.9 * p.weightKg) }
}

export function mealTotals(items: FoodItem[] | undefined) {
  return (items || []).reduce(
    (a, it) => ({
      kcal: a.kcal + it.kcal,
      protein: a.protein + it.protein,
      carbs: a.carbs + it.carbs,
      fat: a.fat + it.fat,
      grams: a.grams + (it.grams || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
  )
}

export function dayFoodTotals(meals: MealsByKey) {
  const acc = { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 }
  MEALS.forEach((m) => {
    const t = mealTotals(meals[m.key])
    acc.kcal += t.kcal
    acc.protein += t.protein
    acc.carbs += t.carbs
    acc.fat += t.fat
    acc.grams += t.grams
  })
  return acc
}

export function dayWorkoutKcal(workouts: Workout[] | undefined): number {
  return (workouts || []).reduce((s, w) => s + w.kcal, 0)
}

export function emptyMeals(): MealsByKey {
  return {
    cafeDaManha: [],
    almoco: [],
    lanche: [],
    jantar: [],
    ceia: [],
    preTreino: [],
    posTreino: [],
  }
}

export function emptyDayLog(): DayLog {
  return { weight: null, bodyFatPct: null, meals: emptyMeals(), workouts: [] }
}
