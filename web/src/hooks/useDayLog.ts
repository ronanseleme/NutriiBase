import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { emptyDayLog, emptyMeals } from '../lib/calculations'
import {
  MEAL_KEY_FROM_DB,
  refeicaoRowToLocal,
  treinoRowToLocal,
  type RefeicaoRow,
  type RegistroPesoRow,
  type TreinoRow,
} from '../lib/mappers'
import type { DayLog } from '../types'

export function useDayLog(userId: string | null, dateIso: string) {
  const [log, setLog] = useState<DayLog>(emptyDayLog())
  const [loading, setLoading] = useState(true)

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

  return { log, loading, saveWeight, saveBodyFat, reload }
}
