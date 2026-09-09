import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildDayMap, type DayInsightData } from '../lib/insights'
import type { RefeicaoRow, RegistroPesoRow, TreinoRow } from '../lib/mappers'

export function useYearLogs(userId: string | null, year: number) {
  const [yearMap, setYearMap] = useState<Record<string, DayInsightData>>({})
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!userId) {
      setYearMap({})
      setLoading(false)
      return
    }
    setLoading(true)
    const startIso = `${year}-01-01`
    const endIso = `${year}-12-31`
    const [refeicoesRes, treinosRes, pesosRes] = await Promise.all([
      supabase.from('refeicoes').select('*').eq('user_id', userId).gte('data', startIso).lte('data', endIso),
      supabase.from('treinos').select('*').eq('user_id', userId).gte('data', startIso).lte('data', endIso),
      supabase.from('registros_peso').select('*').eq('user_id', userId).gte('data', startIso).lte('data', endIso),
    ])
    setYearMap(
      buildDayMap(
        (refeicoesRes.data as RefeicaoRow[]) || [],
        (treinosRes.data as TreinoRow[]) || [],
        (pesosRes.data as RegistroPesoRow[]) || [],
      ),
    )
    setLoading(false)
  }, [userId, year])

  useEffect(() => {
    reload()
  }, [reload])

  return { yearMap, loading }
}
