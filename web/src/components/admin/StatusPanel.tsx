import { useEffect, useState } from 'react'
import { fetchSystemStatus, type StatusCheck } from '../../lib/systemStatus'

function Dot({ status }: { status: 'ok' | 'error' | 'checking' }) {
  const color = status === 'ok' ? 'var(--teal)' : status === 'error' ? 'var(--coral)' : 'var(--text-soft)'
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
}

function StatusRow({ check }: { check: StatusCheck }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <Dot status={check.status} />
        <div className="min-w-0">
          <div className="truncate text-[0.86rem] font-semibold">{check.label}</div>
          {check.message && <div className="truncate text-[0.74rem] text-[var(--text-soft)]">{check.message}</div>}
        </div>
      </div>
      <div className="shrink-0 text-right text-[0.74rem] text-[var(--text-soft)]">
        {check.status === 'ok' ? 'Online' : 'Falhou'}
        {check.latencyMs != null && <div>{check.latencyMs}ms</div>}
      </div>
    </div>
  )
}

export function StatusPanel() {
  const [checks, setChecks] = useState<StatusCheck[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  async function runCheck() {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchSystemStatus()
      setChecks(result)
      setCheckedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível verificar o status agora.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runCheck()
  }, [])

  const okCount = checks?.filter((c) => c.status === 'ok').length ?? 0
  const total = checks?.length ?? 0

  return (
    <div className="nb-card">
      <div className="mb-1 flex items-center justify-between">
        <div className="nb-card-title mb-0">Status das conexões</div>
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          className="nb-btn nb-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {loading ? 'Verificando…' : 'Verificar agora'}
        </button>
      </div>
      <p className="mb-3 text-[0.78rem] text-[var(--text-soft)]">
        {checks
          ? `${okCount} de ${total} serviços online`
          : 'Testa a conexão em tempo real com o banco (Postgres), Storage, Auth, Stripe, Gemini e Mercado Pago.'}
        {checkedAt && ` · última verificação às ${checkedAt.toLocaleTimeString('pt-BR')}`}
      </p>

      {error && (
        <div className="mb-3 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] p-2.5 text-[0.82rem] text-[var(--coral)]">
          {error}
        </div>
      )}

      {loading && !checks && <p className="text-[0.86rem] text-[var(--text-soft)]">Verificando conexões…</p>}

      {checks && (
        <div>
          {checks.map((c) => (
            <StatusRow key={c.key} check={c} />
          ))}
        </div>
      )}

      <p className="mt-3 text-[0.72rem] text-[var(--text-soft)]">
        O plano de cobrança do Supabase (Pro/Free) não aparece aqui — isso é configuração de conta, só visível no
        painel do Supabase em Settings → Billing.
      </p>
    </div>
  )
}
