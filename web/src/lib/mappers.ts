import type { FoodItem, GoalKey, MealKey, Profile, Workout } from '../types'

export const MEAL_KEY_TO_DB: Record<MealKey, string> = {
  cafeDaManha: 'cafe_da_manha',
  almoco: 'almoco',
  lanche: 'lanche',
  jantar: 'jantar',
  ceia: 'ceia',
  preTreino: 'pre_treino',
  posTreino: 'pos_treino',
}

export const MEAL_KEY_FROM_DB: Record<string, MealKey> = Object.fromEntries(
  Object.entries(MEAL_KEY_TO_DB).map(([k, v]) => [v, k as MealKey]),
)

const GOAL_TO_DB: Record<string, string> = { ganho: 'ganho_massa' }
const GOAL_FROM_DB: Record<string, GoalKey> = { ganho_massa: 'ganho' }

export function goalToDb(g: GoalKey): string {
  return GOAL_TO_DB[g] || g
}
export function goalFromDb(g: string): GoalKey {
  return GOAL_FROM_DB[g] || (g as GoalKey)
}

// --- profiles ---
export interface ProfileRow {
  id: string
  nome: string | null
  idade: number | null
  sexo: string | null
  altura_cm: number | null
  peso_atual_kg: number | null
  percentual_gordura_atual: number | null
  nivel_atividade: string | null
  objetivo: string | null
  ritmo: string | null
  peso_meta_kg: number | null
  percentual_gordura_meta: number | null
  data_meta: string | null
  meta_treinos_semanais: number | null
  restricoes_alimentares: string | null
  meta_calorica_diaria: number | null
  meta_proteina_g: number | null
  meta_carbo_g: number | null
  meta_gordura_g: number | null
}

export function profileToDbRow(p: Profile, userId: string) {
  const restrText = p.restrictions
    ? [...(p.restrictions.tags || []), ...(p.restrictions.note ? [p.restrictions.note] : [])].join(', ')
    : ''
  return {
    id: userId,
    nome: p.name || '',
    idade: p.age || null,
    sexo: p.sex || null,
    altura_cm: p.heightCm || null,
    peso_atual_kg: p.weightKg || null,
    percentual_gordura_atual: p.bodyFatPct ?? null,
    nivel_atividade: p.activity,
    objetivo: goalToDb(p.goal),
    ritmo: p.pace,
    peso_meta_kg: p.targetWeightKg ?? null,
    percentual_gordura_meta: p.bodyFatTargetPct ?? null,
    data_meta: p.targetDate || null,
    meta_treinos_semanais: p.weeklyWorkoutGoal ?? null,
    restricoes_alimentares: restrText || null,
    meta_calorica_diaria: p.targets?.kcal ?? null,
    meta_proteina_g: p.targets?.protein ?? null,
    meta_carbo_g: p.targets?.carb ?? null,
    meta_gordura_g: p.targets?.fat ?? null,
  }
}

export function dbProfileToLocal(row: ProfileRow): Omit<Profile, 'targets'> {
  return {
    id: row.id,
    name: row.nome || '',
    age: row.idade || 30,
    sex: (row.sexo as 'F' | 'M') || 'F',
    heightCm: row.altura_cm || 165,
    weightKg: row.peso_atual_kg || 70,
    bodyFatPct: row.percentual_gordura_atual ?? null,
    activity: (row.nivel_atividade as Profile['activity']) || 'moderado',
    goal: row.objetivo ? goalFromDb(row.objetivo) : 'manutencao',
    pace: (row.ritmo as Profile['pace']) || 'moderado',
    targetWeightKg: row.peso_meta_kg ?? null,
    bodyFatTargetPct: row.percentual_gordura_meta ?? null,
    targetDate: row.data_meta || null,
    weeklyWorkoutGoal: row.meta_treinos_semanais ?? null,
    restrictions: { tags: [], note: row.restricoes_alimentares || '' },
    macroOverride: null,
  }
}

// --- refeicoes ---
export interface RefeicaoRow {
  id: string
  data: string
  tipo_refeicao: string
  nome_alimento: string
  porcao: number | null
  unidade: string | null
  kcal: number
  proteina_g: number
  carboidrato_g: number
  gordura_g: number
  descricao_ia: string | null
}

export function refeicaoRowToLocal(row: RefeicaoRow): FoodItem {
  return {
    id: row.id,
    name: row.nome_alimento,
    grams: row.porcao,
    kcal: row.kcal,
    protein: row.proteina_g,
    carbs: row.carboidrato_g,
    fat: row.gordura_g,
    descricaoIa: row.descricao_ia,
  }
}

export function refeicaoLocalToRow(item: FoodItem, userId: string, dataIso: string, mealKey: MealKey) {
  return {
    user_id: userId,
    data: dataIso,
    tipo_refeicao: MEAL_KEY_TO_DB[mealKey],
    nome_alimento: item.name,
    porcao: item.grams ?? null,
    unidade: item.grams != null ? 'g' : null,
    kcal: item.kcal,
    proteina_g: item.protein,
    carboidrato_g: item.carbs,
    gordura_g: item.fat,
    descricao_ia: item.descricaoIa || null,
  }
}

// --- treinos ---
export interface TreinoRow {
  id: string
  data: string
  tipo_atividade: string
  duracao_min: number | null
  intensidade: string | null
  distancia_km: number | null
  pace_min_km: number | null
  kcal_estimado: number
  observacoes: string | null
}

export function treinoRowToLocal(row: TreinoRow): Workout {
  return {
    id: row.id,
    type: row.tipo_atividade as Workout['type'],
    mode: row.distancia_km != null ? 'distancia' : 'duracao',
    durationMin: row.duracao_min,
    intensity: row.intensidade as Workout['intensity'],
    distanceKm: row.distancia_km,
    paceMinKm: row.pace_min_km,
    note: row.observacoes || '',
    kcal: row.kcal_estimado,
  }
}

export function treinoLocalToRow(w: Workout, userId: string, dataIso: string) {
  const isDist = w.mode === 'distancia'
  return {
    user_id: userId,
    data: dataIso,
    tipo_atividade: w.type,
    duracao_min: isDist ? null : (w.durationMin ?? null),
    intensidade: isDist ? null : (w.intensity || null),
    distancia_km: isDist ? w.distanceKm : null,
    pace_min_km: isDist ? w.paceMinKm : null,
    kcal_estimado: w.kcal,
    observacoes: w.note || null,
  }
}

// --- registros_peso ---
export interface RegistroPesoRow {
  data: string
  peso_kg: number | null
  percentual_gordura: number | null
}
