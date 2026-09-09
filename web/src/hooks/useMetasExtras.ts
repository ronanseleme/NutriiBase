import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, toISODate } from '../lib/dateUtils'

function mondayOfThisWeek(): Date {
  const now = new Date()
  const dow = now.getDay()
  return addDays(now, dow === 0 ? -6 : 1 - dow)
}

export function useMetasExtras(userId: string | null, currentWeightKg: number) {
  const [startWeight, setStartWeight] = useState<number | null>(null)
  const [weekWorkoutCount, setWeekWorkoutCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!userId) {
      setStartWeight(null)
      setWeekWorkoutCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    const monday = mondayOfThisWeek()
    const mondayIso = toISODate(monday)
    const sundayIso = toISODate(addDays(monday, 6))

    const [firstWeightRes, weekWorkoutsRes] = await Promise.all([
      supabase
        .from('registros_peso')
        .select('peso_kg')
        .eq('user_id', userId)
        .not('peso_kg', 'is', null)
        .order('data', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('treinos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('data', mondayIso)
        .lte('data', sundayIso),
    ])

    setStartWeight((firstWeightRes.data as { peso_kg: number } | null)?.peso_kg ?? null)
    setWeekWorkoutCount(weekWorkoutsRes.count ?? 0)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  return { startWeight: startWeight ?? currentWeightKg, weekWorkoutCount, loading, reload }
}
