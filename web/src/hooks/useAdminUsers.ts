import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AccessRole } from '../types'

export interface AdminUserRow {
  id: string
  nome: string
  email: string
  role: AccessRole
  creditosIa: number
  creditosMensais: number
  dataInicioPro: string | null
  dataProximaRenovacao: string | null
  createdAt: string
}

interface AdminListUsersRow {
  id: string
  nome: string | null
  email: string
  role: AccessRole
  creditos_ia: number
  creditos_mensais: number
  data_inicio_pro: string | null
  data_proxima_renovacao: string | null
  created_at: string
}

function mapRow(r: AdminListUsersRow): AdminUserRow {
  return {
    id: r.id,
    nome: r.nome || '(sem nome)',
    email: r.email,
    role: r.role,
    creditosIa: r.creditos_ia,
    creditosMensais: r.creditos_mensais,
    dataInicioPro: r.data_inicio_pro,
    dataProximaRenovacao: r.data_proxima_renovacao,
    createdAt: r.created_at,
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

  const adjustCreditos = useCallback(
    async (userId: string, delta: number, motivo?: string) => {
      const { error: err } = await supabase.rpc('admin_adjust_creditos', {
        target_user: userId,
        delta,
        motivo: motivo || null,
      })
      if (!err) await reload()
      return { error: err }
    },
    [reload],
  )

  const setCreditosMensais = useCallback(
    async (userId: string, novoValor: number) => {
      const { error: err } = await supabase.rpc('admin_set_creditos_mensais', {
        target_user: userId,
        novo_valor: novoValor,
      })
      if (!err) await reload()
      return { error: err }
    },
    [reload],
  )

  return { users, loading, error, reload, promote, demote, adjustCreditos, setCreditosMensais }
}
