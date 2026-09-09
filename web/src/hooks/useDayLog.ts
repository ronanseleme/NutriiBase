import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { emptyDayLog, emptyMeals } from '../lib/calculations'
import {
  MEAL_KEY_FROM_DB,
  refeicaoLocalToRow,
  refeicaoRowToLocal,
  treinoRowToLocal,
  type RefeicaoRow,
  type RegistroPesoRow,
  type TreinoRow,
} from '../lib/mappers'
import type { DayLog, FoodItem, MealKey, MealsByKey } from '../types'

export function useDayLog(userId: string | null, dateIso: string) {
  const [log, setLog] = useState<DayLog>(emptyDayLog())
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<MealsByKey>(emptyMeals())

  const reload = useCallback(async () => {
    if (!userId) {
      setLog(emptyDayLog())
      setLoading(false)
      return
    }
    setLoading(true)
    const [refeicoesRes, treinosRes, pesoRes] = await Promise.all([
      supabase.from('refeicoes').select('*').eq('user_id', userId).eq('data', dateIso),
      supabase.from('treinos').select('*').eq('user_id', userId).eq('data', dateIso),
      supabase.from('registros_peso').select('*').eq('user_id', userId).eq('data', dateIso).maybeSingle(),
    ])

    const meals = emptyMeals()
    ;((refeicoesRes.data as RefeicaoRow[]) || []).forEach((row) => {
      const key = MEAL_KEY_FROM_DB[row.tipo_refeicao]
      if (key) meals[key].push(refeicaoRowToLocal(row))
    })
    const workouts = ((treinosRes.data as TreinoRow[]) || []).map(treinoRowToLocal)
    const pesoRow = pesoRes.data as RegistroPesoRow | null

    setLog({
      weight: pesoRow?.peso_kg ?? null,
      bodyFatPct: pesoRow?.percentual_gordura ?? null,
      meals,
      workouts,
    })
    setLoading(false)
  }, [userId, dateIso])

  useEffect(() => {
    reload()
  }, [reload])

  // Muda de dia (ou de usuário) descarta rascunhos não salvos, como no app original.
  useEffect(() => {
    setDraft(emptyMeals())
  }, [userId, dateIso])

  const saveWeight = useCallback(
    async (kg: number) => {
      if (!userId) return { error: new Error('Sem usuário logado.') }
      const { error } = await supabase
        .from('registros_peso')
        .upsert({ user_id: userId, data: dateIso, peso_kg: kg }, { onConflict: 'user_id,data' })
      if (!error) setLog((l) => ({ ...l, weight: kg }))
      return { error }
    },
    [userId, dateIso],
  )

  const saveBodyFat = useCallback(
    async (pct: number) => {
      if (!userId) return { error: new Error('Sem usuário logado.') }
      const { error } = await supabase
        .from('registros_peso')
        .upsert({ user_id: userId, data: dateIso, percentual_gordura: pct }, { onConflict: 'user_id,data' })
      if (!error) setLog((l) => ({ ...l, bodyFatPct: pct }))
      return { error }
    },
    [userId, dateIso],
  )

  const addToDraft = useCallback((mealKey: MealKey, item: FoodItem) => {
    setDraft((d) => ({ ...d, [mealKey]: [...d[mealKey], item] }))
  }, [])

  const removeDraftItem = useCallback((mealKey: MealKey, itemId: string) => {
    setDraft((d) => ({ ...d, [mealKey]: d[mealKey].filter((it) => it.id !== itemId) }))
  }, [])

  const saveMeal = useCallback(
    async (mealKey: MealKey) => {
      if (!userId) return { error: new Error('Sem usuário logado.') }
      const items = draft[mealKey]
      if (!items.length) return { error: null }
      const rows = items.map((it) => refeicaoLocalToRow(it, userId, dateIso, mealKey))
      const { data, error } = await supabase.from('refeicoes').insert(rows).select()
      if (error) return { error }
      const inserted = (data as RefeicaoRow[]) || []
      const merged =
        inserted.length === items.length ? items.map((it, i) => ({ ...it, id: inserted[i].id })) : items
      setLog((l) => ({ ...l, meals: { ...l.meals, [mealKey]: [...l.meals[mealKey], ...merged] } }))
      setDraft((d) => ({ ...d, [mealKey]: [] }))
      return { error: null }
    },
    [userId, dateIso, draft],
  )

  const deleteFoodItem = useCallback(async (mealKey: MealKey, itemId: string) => {
    setLog((l) => ({ ...l, meals: { ...l.meals, [mealKey]: l.meals[mealKey].filter((it) => it.id !== itemId) } }))
    const { error } = await supabase.from('refeicoes').delete().eq('id', itemId)
    return { error }
  }, [])

  const updateFoodItem = useCallback(
    async (mealKey: MealKey, item: FoodItem) => {
      if (!userId) return { error: new Error('Sem usuário logado.') }
      setLog((l) => ({
        ...l,
        meals: { ...l.meals, [mealKey]: l.meals[mealKey].map((it) => (it.id === item.id ? item : it)) },
      }))
      const { error } = await supabase
        .from('refeicoes')
        .update(refeicaoLocalToRow(item, userId, dateIso, mealKey))
        .eq('id', item.id)
      return { error }
    },
    [userId, dateIso],
  )

  return {
    log,
    loading,
    draft,
    saveWeight,
    saveBodyFat,
    addToDraft,
    removeDraftItem,
    saveMeal,
    deleteFoodItem,
    updateFoodItem,
    reload,
  }
}
