import { todayISO } from '../lib/dateUtils'
import type { AiAccess } from '../types'

export function CreditsBadge({ access }: { access: AiAccess }) {
  if (access.role === 'pro') {
    // Pro é ilimitado de verdade — sem contador, sem limite mensal.
    return (
      <div
        className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-bold text-[var(--gold)]"
        style={{ background: 'color-mix(in srgb, var(--gold) 12%, var(--surface))' }}
      >
        ⚡ IA ilimitada
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
