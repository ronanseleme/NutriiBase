import { daysUntil } from '../lib/dateUtils'
import type { AiAccess } from '../types'

export function CreditsBadge({ access }: { access: AiAccess }) {
  if (access.role !== 'pro') return null
  const dias = access.dataProximaRenovacao ? daysUntil(access.dataProximaRenovacao) : null
  return (
    <div
      className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-bold text-[var(--blue)]"
      style={{ background: 'color-mix(in srgb, var(--blue) 12%, var(--surface))' }}
    >
      ⚡ {access.creditosIa}/{access.creditosMensais} créditos
      {dias != null && <span className="font-semibold opacity-80">· renova em {dias} {dias === 1 ? 'dia' : 'dias'}</span>}
    </div>
  )
}
