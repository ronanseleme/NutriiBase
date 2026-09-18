import { daysUntil, todayISO } from '../lib/dateUtils'
import type { AiAccess } from '../types'

export function CreditsBadge({ access }: { access: AiAccess }) {
  if (access.role === 'pro') {
    const dias = access.dataProximaRenovacao ? daysUntil(access.dataProximaRenovacao) : null
    return (
      <div
        className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-bold text-[var(--gold)]"
        style={{ background: 'color-mix(in srgb, var(--gold) 12%, var(--surface))' }}
      >
        ⚡ {access.creditosIa}/{access.creditosMensais} créditos
        {dias != null && <span className="font-semibold opacity-80">· renova em {dias} {dias === 1 ? 'dia' : 'dias'}</span>}
      </div>
    )
  }
  if (access.role === 'free') {
    // O contador só é confiável quando "hoje" — se a última vez que o
    // perfil foi carregado foi num dia anterior, o valor salvo é de um dia
    // que já resetou no banco (mesma lógica do pré-check no backend).
    const usadasHoje = access.estimativasIaFreeData === todayISO() ? access.estimativasIaFreeHoje : 0
    return (
      <div
        className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-bold text-[var(--purple)]"
        style={{ background: 'color-mix(in srgb, var(--purple) 12%, var(--surface))' }}
      >
        ✨ {usadasHoje}/3 estimativas de IA hoje
      </div>
    )
  }
  return null
}
