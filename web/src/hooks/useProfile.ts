import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { computeTargets } from '../lib/calculations'
import { dbProfileToLocal, profileToDbRow, type ProfileRow } from '../lib/mappers'
import { newProfile } from '../lib/newProfile'
import type { Profile } from '../types'

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isNew, setIsNew] = useState(false)

  // Guarda o userId "atual" pra fetchProfile descartar uma resposta tardia
  // se o usuário já tiver trocado (logout/login rápido) antes dela voltar.
  const currentUserIdRef = useRef(userId)
  currentUserIdRef.current = userId

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (currentUserIdRef.current !== userId) return
    if (error || !data) {
      // Sem linha ainda (não deveria acontecer com o trigger de auto-criação,
      // mas cobre contas antigas de antes dele existir).
      setProfile(newProfile(userId))
      setIsNew(true)
    } else {
      const row = data as ProfileRow
      const base = dbProfileToLocal(row)
      setProfile({ ...base, targets: computeTargets(base) })
      // A linha já existe desde o cadastro (trigger auto-cria, inclusive no
      // login com Google) — "novo" aqui significa "ainda não completou o
      // onboarding", não "sem linha no banco".
      setIsNew(row.idade == null || row.altura_cm == null || row.peso_atual_kg == null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Refaz o fetch sob demanda, sem trocar userId — usado depois que um Pix
  // confirma e vira Pro, pra atualizar profile.role na hora, sem reload.
  const refetch = useCallback(() => fetchProfile(), [fetchProfile])

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

  return { profile, loading, isNew, saveProfile, refetch }
}
