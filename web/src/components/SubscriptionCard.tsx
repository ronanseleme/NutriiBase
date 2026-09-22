import { CreditsBadge } from './CreditsBadge'
import { PlanSelector } from './PlanSelector'
import { SubscriptionDetails } from './SubscriptionDetails'
import type { Profile } from '../types'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(iso))
}

export function SubscriptionCard({ profile, onProfileRefresh }: { profile: Profile; onProfileRefresh: () => void }) {
  if (profile.role === 'admin') {
    return (
      <div className="nb-card">
        <div className="nb-card-title">Assinatura</div>
        <p className="text-[0.85rem] text-[var(--text-soft)]">Contas de administrador não têm cobrança.</p>
      </div>
    )
  }
  if (profile.role === 'pro') return <ProPlanCard profile={profile} onProfileRefresh={onProfileRefresh} />
  return <FreePlanCard onProfileRefresh={onProfileRefresh} />
}

function ProPlanCard({ profile, onProfileRefresh }: { profile: Profile; onProfileRefresh: () => void }) {
  const isLicencaAvulsa = !!profile.licencaAvulsaExpiraEm

  return (
    <div className="nb-card">
      <div className="nb-card-title">Assinatura</div>
      <CreditsBadge access={profile} />

      {isLicencaAvulsa ? (
        <>
          <p className="mb-3 text-[0.84rem] text-[var(--text-soft)]">
            Licença avulsa (Pix) válida até <b className="text-[var(--text)]">{formatDate(profile.licencaAvulsaExpiraEm!)}</b>. Compre
            mais meses antes de vencer pra continuar com o Pro sem interrupção.
          </p>
          <PlanSelector onProfileRefresh={onProfileRefresh} />
        </>
      ) : (
        <SubscriptionDetails />
      )}
    </div>
  )
}

function FreePlanCard({ onProfileRefresh }: { onProfileRefresh: () => void }) {
  return (
    <div className="nb-card">
      <div className="nb-card-title">Assinatura</div>
      <p className="mb-3 text-[0.84rem] text-[var(--text-soft)]">
        Assine o Pro e desbloqueie descrever refeições com IA (texto e voz), chat nutricional e insights personalizados.
      </p>
      <PlanSelector onProfileRefresh={onProfileRefresh} />
    </div>
  )
}
