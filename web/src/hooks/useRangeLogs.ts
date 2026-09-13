import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildDayMap, type DayInsightData } from '../lib/insights'
import type { RefeicaoRow, RegistroPesoRow, TreinoRow } from '../lib/mappers'

/** Como useMonthLogs, mas para um intervalo [startIso, endIso] arbitrário
 * (pode atravessar meses) — usado pela visão "Mensal"/Período, que soma
 * do dia 1 do mês até a data selecionada por padrão, ou um período
 * arrastado pelo usuário no calendário. */
export function useRangeLogs(userId: string | null, startIso: string, endIso: string) {
  const [rangeMap, setRangeMap] = useState<Record<string, DayInsightData>>({})
  const [refeicoes, setRefeicoes] = useState<RefeicaoRow[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!userId) {
      setRangeMap({})
      setRefeicoes([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [refeicoesRes, treinosRes, pesosRes] = await Promise.all([
      supabase.from('refeicoes').select('*').eq('user_id', userId).gte('data', startIso).lte('data', endIso),
      supabase.from('treinos').select('*').eq('user_id', userId).gte('data', startIso).lte('data', endIso),
      supabase.from('registros_peso').select('*').eq('user_id', userId).gte('data', startIso).lte('data', endIso),
    ])
    const refeicoesData = (refeicoesRes.data as RefeicaoRow[]) || []
    setRefeicoes(refeicoesData)
    setRangeMap(
      buildDayMap(
        refeicoesData,
        (treinosRes.data as TreinoRow[]) || [],
        (pesosRes.data as RegistroPesoRow[]) || [],
      ),
    )
    setLoading(false)
  }, [userId, startIso, endIso])

  useEffect(() => {
    reload()
  }, [reload])

  return { rangeMap, refeicoes, loading, reload }
}
