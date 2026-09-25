import { useEffect, useState } from 'react'
import { fetchSystemStatus, type StatusCheck, type StorageUsage } from '../../lib/systemStatus'

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 ? 2 : 1 })} ${units[i]}`
}

function UsageBar({ label, usedBytes, quotaBytes }: { label: string; usedBytes: number; quotaBytes: number }) {
  const pct = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0
  const barColor = pct >= 95 ? 'var(--coral)' : pct >= 80 ? 'var(--gold)' : 'var(--teal)'
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[0.82rem]">
        <span className="font-semibold">{label}</span>
        <span className="text-[var(--text-soft)]">
          {formatBytes(usedBytes)} de {formatBytes(quotaBytes)} <span className="opacity-70">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function StoragePanel({ storage }: { storage: StorageUsage }) {
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-[var(--line)] pt-3">
      <UsageBar label="Banco de dados (Postgres)" usedBytes={storage.dbBytes} quotaBytes={storage.dbQuotaBytes} />
      <UsageBar label="Storage" usedBytes={storage.storageBytes} quotaBytes={storage.storageQuotaBytes} />
      {storage.buckets.length > 0 && (
        <div className="flex flex-col gap-1">
          {storage.buckets.map((b) => (
            <div key={b.bucket} className="flex items-center justify-between text-[0.74rem] text-[var(--text-soft)]">
              <span>
                {b.bucket} · {b.objects} arquivo{b.objects === 1 ? '' : 's'}
              </span>
              <span>{formatBytes(b.bytes)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[0.72rem] text-[var(--text-soft)]">
        Cotas incluídas no plano Pro do Supabase (8 GB de banco, 100 GB de Storage) — acima disso não trava nada,
        vira cobrança extra por uso.
      </p>
    </div>
  )
}

export function StatusPanel() {
  const [checks, setChecks] = useState<StatusCheck[] | null>(null)
  const [storage, setStorage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  async function runCheck() {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchSystemStatus()
      setChecks(result.checks)
      setStorage(result.storage)
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

      {storage && <StoragePanel storage={storage} />}

      <p className="mt-3 text-[0.72rem] text-[var(--text-soft)]">
        O plano de cobrança do Supabase (Pro/Free) não aparece aqui — isso é configuração de conta, só visível no
        painel do Supabase em Settings → Billing.
      </p>
    </div>
  )
}
