import { useState } from 'react'
import { useAdminUsers } from '../../hooks/useAdminUsers'
import { AdminUserCard } from './AdminUserCard'
import { UserHistoryModal } from './UserHistoryModal'

export function AdminTab() {
  const { users, loading, error, promote, demote, adjustCreditos, setCreditosMensais } = useAdminUsers()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [historyUser, setHistoryUser] = useState<{ id: string; nome: string } | null>(null)

  async function runAction(userId: string, action: () => Promise<{ error: { message: string } | null }>) {
    setBusyId(userId)
    setActionError(null)
    const { error: err } = await action()
    if (err) setActionError(err.message)
    setBusyId(null)
  }

  if (loading) {
    return <div className="nb-card text-[0.86rem] text-[var(--text-soft)]">Carregando usuários…</div>
  }

  if (error) {
    return <div className="nb-card text-[0.86rem] text-[var(--coral)]">Erro ao carregar usuários: {error}</div>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="nb-card-title px-1">Administração · {users.length} usuário{users.length === 1 ? '' : 's'}</div>
      {actionError && (
        <div className="nb-card border-l-4 border-[var(--coral)] text-[0.84rem] text-[var(--coral)]">{actionError}</div>
      )}
      {users.map((u) => (
        <AdminUserCard
          key={u.id}
          user={u}
          busy={busyId === u.id}
          onPromote={() => runAction(u.id, () => promote(u.id))}
          onDemote={() => runAction(u.id, () => demote(u.id))}
          onAdjustCreditos={(delta, motivo) => runAction(u.id, () => adjustCreditos(u.id, delta, motivo))}
          onSetCreditosMensais={(novoValor) => runAction(u.id, () => setCreditosMensais(u.id, novoValor))}
          onViewHistory={() => setHistoryUser({ id: u.id, nome: u.nome })}
        />
      ))}

      {historyUser && (
        <UserHistoryModal userId={historyUser.id} userName={historyUser.nome} onClose={() => setHistoryUser(null)} />
      )}
    </div>
  )
}
