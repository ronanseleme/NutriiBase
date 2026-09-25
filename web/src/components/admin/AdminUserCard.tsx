import { useState } from 'react'
import { RoleBadge } from '../RoleBadge'
import type { AdminUserRow } from '../../hooks/useAdminUsers'

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

interface Props {
  user: AdminUserRow
  busy: boolean
  onPromote: () => Promise<void>
  onDemote: () => Promise<void>
  onViewHistory: () => void
}

export function AdminUserCard({ user, busy, onPromote, onDemote, onViewHistory }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmRoleChange, setConfirmRoleChange] = useState<'promote' | 'demote' | null>(null)

  return (
    <div className="nb-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold">{user.nome}</span>
            <RoleBadge role={user.role} />
          </div>
          <div className="truncate text-[0.78rem] text-[var(--text-soft)]">{user.email}</div>
        </div>
        <span className="shrink-0 text-[var(--text-soft)]">{expanded ? '▲' : '▼'}</span>
      </button>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[0.72rem] text-[var(--text-soft)]">
        <span className="rounded-full bg-[var(--bg)] px-2.5 py-1">Cadastro {fmtDate(user.createdAt)}</span>
        <span className="rounded-full bg-[var(--bg)] px-2.5 py-1">
          Último acesso {user.ultimoLogin ? fmtDate(user.ultimoLogin) : 'nunca'}
        </span>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-[var(--line)] pt-3">
          <div className="flex flex-wrap gap-2">
            {user.role !== 'admin' && user.role === 'free' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmRoleChange('promote')}
                className="nb-btn nb-btn-blue px-3 py-1.5 text-xs"
              >
                Promover a Pro
              </button>
            )}
            {user.role === 'pro' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmRoleChange('demote')}
                className="nb-btn nb-btn-secondary px-3 py-1.5 text-xs"
              >
                Rebaixar a Free
              </button>
            )}
            <button
              type="button"
              onClick={onViewHistory}
              className="nb-btn nb-btn-secondary px-3 py-1.5 text-xs"
            >
              Ver histórico
            </button>
          </div>
        </div>
      )}

      {confirmRoleChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
          <div className="nb-modal w-full max-w-sm">
            <h2 className="mb-2 text-[1.05rem] font-bold">
              {confirmRoleChange === 'promote' ? 'Promover a Pro?' : 'Rebaixar a Free?'}
            </h2>
            <p className="mb-4 text-[0.86rem] text-[var(--text-soft)]">
              {confirmRoleChange === 'promote'
                ? `${user.nome} passa a ter acesso completo e ilimitado à IA.`
                : `${user.nome} perde acesso à IA imediatamente.`}
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmRoleChange(null)}
                className="nb-btn nb-btn-secondary px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (confirmRoleChange === 'promote') await onPromote()
                  else await onDemote()
                  setConfirmRoleChange(null)
                }}
                className="nb-btn nb-btn-primary px-4 py-2 text-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
