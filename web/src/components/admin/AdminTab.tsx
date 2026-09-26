import { useState } from 'react'
import { useAdminUsers } from '../../hooks/useAdminUsers'
import { AdminUserCard } from './AdminUserCard'
import { UserHistoryModal } from './UserHistoryModal'
import { StatusPanel } from './StatusPanel'
import { EnvironmentsPanel } from './EnvironmentsPanel'

type SubView = 'users' | 'status'

export function AdminTab() {
  const [subView, setSubView] = useState<SubView>('users')
  const { users, loading, error, promote, demote } = useAdminUsers()
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-full bg-[var(--surface)] p-1">
        <button
          type="button"
          onClick={() => setSubView('users')}
          className={`flex-1 rounded-full py-2 text-[0.84rem] font-bold transition-all ${
            subView === 'users' ? 'bg-[image:var(--brand-gradient)] text-white shadow-[0_6px_14px_-6px_rgba(47,111,237,.55)]' : 'text-[var(--text-soft)]'
          }`}
        >
          Usuários
        </button>
        <button
          type="button"
          onClick={() => setSubView('status')}
          className={`flex-1 rounded-full py-2 text-[0.84rem] font-bold transition-all ${
            subView === 'status' ? 'bg-[image:var(--brand-gradient)] text-white shadow-[0_6px_14px_-6px_rgba(47,111,237,.55)]' : 'text-[var(--text-soft)]'
          }`}
        >
          Status
        </button>
      </div>

      {subView === 'status' ? (
        <>
          <EnvironmentsPanel />
          <StatusPanel />
        </>
      ) : loading ? (
        <div className="nb-card text-[0.86rem] text-[var(--text-soft)]">Carregando usuários…</div>
      ) : error ? (
        <div className="nb-card text-[0.86rem] text-[var(--coral)]">Erro ao carregar usuários: {error}</div>
      ) : (
        <>
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
              onViewHistory={() => setHistoryUser({ id: u.id, nome: u.nome })}
            />
          ))}

          {historyUser && (
            <UserHistoryModal userId={historyUser.id} userName={historyUser.nome} onClose={() => setHistoryUser(null)} />
          )}
        </>
      )}
    </div>
  )
}
