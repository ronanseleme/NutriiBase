import { useEffect, useState } from 'react'
import { fetchEnvironmentsStatus, type EnvironmentInfo } from '../../lib/environments'

function Dot({ online }: { online: boolean }) {
  const color = online ? 'var(--teal)' : 'var(--coral)'
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
}

function formatBuildTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function EnvironmentRow({ env }: { env: EnvironmentInfo }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <Dot online={env.online} />
        <div className="min-w-0">
          <div className="truncate text-[0.86rem] font-semibold">{env.label}</div>
          <div className="truncate text-[0.74rem] text-[var(--text-soft)]">
            {env.online ? `atualizado em ${formatBuildTime(env.buildTime)}` : (env.error ?? 'fora do ar')}
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right text-[0.74rem] text-[var(--text-soft)]">
        {env.version ? (
          <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[0.8rem] font-bold text-[var(--text)]">
            v{env.version}
          </span>
        ) : (
          <span>{env.online ? 'Online' : 'Offline'}</span>
        )}
      </div>
    </div>
  )
}

export function EnvironmentsPanel() {
  const [environments, setEnvironments] = useState<EnvironmentInfo[] | null>(null)
  const [loading, setLoading] = useState(true)

  async function runCheck() {
    setLoading(true)
    try {
      setEnvironments(await fetchEnvironmentsStatus())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runCheck()
  }, [])

  return (
    <div className="nb-card">
      <div className="mb-1 flex items-center justify-between">
        <div className="nb-card-title mb-0">Ambientes</div>
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          className="nb-btn nb-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {loading ? 'Verificando…' : 'Verificar agora'}
        </button>
      </div>
      <p className="mb-3 text-[0.78rem] text-[var(--text-soft)]">Versão publicada e último build de cada ambiente.</p>

      {loading && !environments && <p className="text-[0.86rem] text-[var(--text-soft)]">Verificando ambientes…</p>}

      {environments && (
        <div>
          {environments.map((env) => (
            <EnvironmentRow key={env.key} env={env} />
          ))}
        </div>
      )}
    </div>
  )
}
