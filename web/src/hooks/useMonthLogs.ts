import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { daysInMonth, pad } from '../lib/dateUtils'
import { buildDayMap, type DayInsightData } from '../lib/insights'
import type { RefeicaoRow, RegistroPesoRow, TreinoRow } from '../lib/mappers'

export function useMonthLogs(userId: string | null, y: number, m: number) {
  const [monthMap, setMonthMap] = useState<Record<string, DayInsightData>>({})
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!userId) {
      setMonthMap({})
      setLoading(false)
      return
    }
    setLoading(true)
    const dim = daysInMonth(y, m)
    const startIso = `${y}-${pad(m)}-01`
    const endIso = `${y}-${pad(m)}-${pad(dim)}`
    const [refeicoesRes, treinosRes, pesosRes] = await Promise.all([
      supabase.from('refeicoes').select('*').eq('user_id', userId).gte('data', startIso).lte('data', endIso),
      supabase.from('treinos').select('*').eq('user_id', userId).gte('data', startIso).lte('data', endIso),
      supabase.from('registros_peso').select('*').eq('user_id', userId).gte('data', startIso).lte('data', endIso),
    ])
    setMonthMap(
      buildDayMap(
        (refeicoesRes.data as RefeicaoRow[]) || [],
        (treinosRes.data as TreinoRow[]) || [],
        (pesosRes.data as RegistroPesoRow[]) || [],
      ),
    )
    setLoading(false)
  }, [userId, y, m])

  useEffect(() => {
    reload()
  }, [reload])

  return { monthMap, loading }
}
