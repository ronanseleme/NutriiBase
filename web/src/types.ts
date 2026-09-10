export type AccessRole = 'admin' | 'pro' | 'free'
export type Sex = 'F' | 'M'
export type ActivityKey = 'leve' | 'moderado' | 'intenso'
export type GoalKey = 'emagrecimento' | 'manutencao' | 'ganho'
export type PaceKey = 'lento' | 'moderado' | 'agressivo'
export type MealKey =
  | 'cafeDaManha'
  | 'almoco'
  | 'lanche'
  | 'jantar'
  | 'ceia'
  | 'preTreino'
  | 'posTreino'
export type WorkoutType = 'musculacao' | 'corrida' | 'ciclismo' | 'funcional' | 'natacao' | 'outro'
export type WorkoutIntensity = 'leve' | 'moderada' | 'intensa'
export type WorkoutMode = 'duracao' | 'distancia'

export interface MacroOverride {
  proteinG: number | null
  fatG: number | null
}

export interface Restrictions {
  tags: string[]
  note: string
}

export interface Targets {
  tmb: number
  get: number
  kcal: number
  protein: number
  fat: number
  carb: number
  safety: { belowFloor: boolean; belowTMB: boolean }
  usingLBM: boolean
  leanMassKg: number | null
  usingGoalBased: boolean
  activityFactor: number
  activityLabel: string
  adjustmentKcal: number
  adjustmentLabel: string
  proteinPerKg: number
  proteinBaseKg: number
  fatPerKg: number
}

export interface Profile {
  id: string | null
  name: string
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  bodyFatPct: number | null
  activity: ActivityKey
  goal: GoalKey
  pace: PaceKey
  targetWeightKg: number | null
  bodyFatTargetPct: number | null
  targetDate: string | null
  weeklyWorkoutGoal: number | null
  restrictions: Restrictions
  macroOverride: MacroOverride | null
  targets: Targets
  role: AccessRole
  creditosIa: number
  creditosMensais: number
  dataProximaRenovacao: string | null
}

// Subconjunto de Profile usado só para as regras de acesso a IA (Chat e
// Descrever refeição com IA) — evita passar o Profile inteiro por props
// que só precisam saber o papel/créditos do usuário.
export interface AiAccess {
  role: AccessRole
  creditosIa: number
  creditosMensais: number
  dataProximaRenovacao: string | null
}

export interface FoodItem {
  id: string
  name: string
  grams: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  descricaoIa?: string | null
}

export interface Workout {
  id: string
  type: WorkoutType
  mode: WorkoutMode
  durationMin: number | null
  intensity: WorkoutIntensity | null
  distanceKm: number | null
  paceMinKm: number | null
  note: string
  kcal: number
}

export type MealsByKey = Record<MealKey, FoodItem[]>

export interface DayLog {
  weight: number | null
  bodyFatPct: number | null
  meals: MealsByKey
  workouts: Workout[]
}
