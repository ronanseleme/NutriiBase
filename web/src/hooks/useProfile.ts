import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { computeTargets } from '../lib/calculations'
import { dbProfileToLocal, profileToDbRow, type ProfileRow } from '../lib/mappers'
import { newProfile } from '../lib/newProfile'
import type { Profile } from '../types'

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setProfile(newProfile(userId))
          setIsNew(true)
        } else {
          const base = dbProfileToLocal(data as ProfileRow)
          setProfile({ ...base, targets: computeTargets(base) })
          setIsNew(false)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const saveProfile = useCallback(
    async (updates: Partial<Omit<Profile, 'id' | 'targets'>>) => {
      if (!userId || !profile) return { error: new Error('Sem usuário logado.') }
      const merged: Profile = { ...profile, ...updates }
      merged.targets = computeTargets(merged)
      const { error } = await supabase.from('profiles').upsert(profileToDbRow(merged, userId))
      if (!error) {
        setProfile(merged)
        setIsNew(false)
      }
      return { error }
    },
    [userId, profile],
  )

  return { profile, loading, isNew, saveProfile }
}
