import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AccessRole } from '../types'

export interface AdminUserRow {
  id: string
  nome: string
  email: string
  role: AccessRole
  dataInicioPro: string | null
  createdAt: string
  ultimoLogin: string | null
}

interface AdminListUsersRow {
  id: string
  nome: string | null
  email: string
  role: AccessRole
  data_inicio_pro: string | null
  created_at: string
  ultimo_login: string | null
}

function mapRow(r: AdminListUsersRow): AdminUserRow {
  return {
    id: r.id,
    nome: r.nome || '(sem nome)',
    email: r.email,
    role: r.role,
    dataInicioPro: r.data_inicio_pro,
    createdAt: r.created_at,
    ultimoLogin: r.ultimo_login,
  }
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('admin_list_users')
    if (err) {
      setError(err.message)
    } else {
      setUsers(((data as AdminListUsersRow[]) || []).map(mapRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const promote = useCallback(
    async (userId: string) => {
      const { error: err } = await supabase.rpc('promote_user_to_pro', { target_user: userId })
      if (!err) await reload()
      return { error: err }
    },
    [reload],
  )

  const demote = useCallback(
    async (userId: string) => {
      const { error: err } = await supabase.rpc('demote_user_to_free', { target_user: userId })
      if (!err) await reload()
      return { error: err }
    },
    [reload],
  )

  return { users, loading, error, reload, promote, demote }
}
