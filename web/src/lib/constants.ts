import type { ActivityKey, GoalKey, MealKey, PaceKey } from '../types'

export const ACTIVITY: { key: ActivityKey; label: string; factor: number }[] = [
  { key: 'leve', label: 'Leve (1–3x/semana)', factor: 1.375 },
  { key: 'moderado', label: 'Moderado (3–5x/semana)', factor: 1.55 },
  { key: 'intenso', label: 'Intenso (6–7x/semana)', factor: 1.725 },
]

export const GOALS: { key: GoalKey; label: string }[] = [
  { key: 'emagrecimento', label: 'Emagrecimento' },
  { key: 'manutencao', label: 'Manutenção' },
  { key: 'ganho', label: 'Ganho de massa' },
]

export const PACES: { key: PaceKey; label: string }[] = [
  { key: 'lento', label: 'Lento' },
  { key: 'moderado', label: 'Moderado' },
  { key: 'agressivo', label: 'Agressivo' },
]

export const DEFICIT_KCAL: Record<PaceKey, number> = { lento: 300, moderado: 500, agressivo: 700 }
export const SURPLUS_PCT: Record<PaceKey, number> = { lento: 0.05, moderado: 0.1, agressivo: 0.18 }

export const MEALS: { key: MealKey; label: string }[] = [
  { key: 'cafeDaManha', label: 'Café da manhã' },
  { key: 'almoco', label: 'Almoço' },
  { key: 'lanche', label: 'Lanche' },
  { key: 'jantar', label: 'Jantar' },
  { key: 'ceia', label: 'Ceia' },
  { key: 'preTreino', label: 'Pré-treino' },
  { key: 'posTreino', label: 'Pós-treino' },
]
