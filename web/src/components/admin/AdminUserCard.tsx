import { useState } from 'react'
import { RoleBadge } from '../RoleBadge'
import { daysUntil } from '../../lib/dateUtils'
import type { AdminUserRow } from '../../hooks/useAdminUsers'

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

interface Props {
  user: AdminUserRow
  busy: boolean
  onPromote: () => Promise<void>
  onDemote: () => Promise<void>
  onAdjustCreditos: (delta: number, motivo: string) => Promise<void>
  onSetCreditosMensais: (novoValor: number) => Promise<void>
  onViewHistory: () => void
}

export function AdminUserCard({
  user,
  busy,
  onPromote,
  onDemote,
  onAdjustCreditos,
  onSetCreditosMensais,
  onViewHistory,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmRoleChange, setConfirmRoleChange] = useState<'promote' | 'demote' | null>(null)
  const [mensaisInput, setMensaisInput] = useState(String(user.creditosMensais))
  const [ajusteDelta, setAjusteDelta] = useState('')
  const [ajusteMotivo, setAjusteMotivo] = useState('')

  const dias = user.dataProximaRenovacao ? daysUntil(user.dataProximaRenovacao) : null

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
        {user.role === 'pro' && (
          <span className="rounded-full bg-[var(--bg)] px-2.5 py-1">
            {user.creditosIa}/{user.creditosMensais} créditos{dias != null ? ` · renova em ${dias} dia${dias === 1 ? '' : 's'}` : ''}
          </span>
        )}
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

          <label className="flex flex-col gap-1">
            <span className="text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
              Limite mensal de créditos
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={mensaisInput}
                onChange={(e) => setMensaisInput(e.target.value)}
                className="nb-input flex-1"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => onSetCreditosMensais(Math.max(0, Math.round(+mensaisInput || 0)))}
                className="nb-btn nb-btn-secondary px-3 text-xs"
              >
                Salvar
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
              Ajuste manual de créditos (saldo atual)
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="+10 ou -5"
                value={ajusteDelta}
                onChange={(e) => setAjusteDelta(e.target.value)}
                className="nb-input w-24"
              />
              <input
                type="text"
                placeholder="Motivo (opcional)"
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
                className="nb-input flex-1"
              />
              <button
                type="button"
                disabled={busy || !ajusteDelta.trim() || Number(ajusteDelta) === 0}
                onClick={async () => {
                  await onAdjustCreditos(Math.round(+ajusteDelta), ajusteMotivo)
                  setAjusteDelta('')
                  setAjusteMotivo('')
                }}
                className="nb-btn nb-btn-secondary px-3 text-xs"
              >
                Aplicar
              </button>
            </div>
          </label>
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
                ? `${user.nome} passa a ter acesso completo à IA, com ${user.creditosMensais} créditos iniciais e renovação a cada 30 dias.`
                : `${user.nome} perde acesso à IA imediatamente e os créditos atuais são zerados. O limite mensal configurado é mantido para uma futura promoção.`}
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
