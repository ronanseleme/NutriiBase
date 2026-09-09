import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, toISODate } from '../lib/dateUtils'
import { buildDayMap, type DayInsightData } from '../lib/insights'
import type { RefeicaoRow, RegistroPesoRow, TreinoRow } from '../lib/mappers'

const WINDOW_DAYS = 120

export function useRecentLogs(userId: string | null) {
  const [recentMap, setRecentMap] = useState<Record<string, DayInsightData>>({})
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!userId) {
      setRecentMap({})
      setLoading(false)
      return
    }
    setLoading(true)
    const startIso = toISODate(addDays(new Date(), -WINDOW_DAYS))
    const [refeicoesRes, treinosRes, pesosRes] = await Promise.all([
      supabase.from('refeicoes').select('*').eq('user_id', userId).gte('data', startIso),
      supabase.from('treinos').select('*').eq('user_id', userId).gte('data', startIso),
      supabase.from('registros_peso').select('*').eq('user_id', userId).gte('data', startIso),
    ])
    setRecentMap(
      buildDayMap(
        (refeicoesRes.data as RefeicaoRow[]) || [],
        (treinosRes.data as TreinoRow[]) || [],
        (pesosRes.data as RegistroPesoRow[]) || [],
      ),
    )
    setLoading(false)
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  return { recentMap, loading, reload }
}
