import { CreditsBadge } from './CreditsBadge'
import { PlanSelector } from './PlanSelector'
import { SubscriptionDetails } from './SubscriptionDetails'
import type { Profile } from '../types'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(iso))
}

export function SubscriptionCard({ profile }: { profile: Profile }) {
  if (profile.role === 'admin') {
    return (
      <div className="nb-card">
        <div className="nb-card-title">Assinatura</div>
        <p className="text-[0.85rem] text-[var(--text-soft)]">Contas de administrador não têm cobrança.</p>
      </div>
    )
  }
  if (profile.role === 'pro') return <ProPlanCard profile={profile} />
  return <FreePlanCard />
}

function ProPlanCard({ profile }: { profile: Profile }) {
  const isLicencaAvulsa = !!profile.licencaAvulsaExpiraEm

  return (
    <div className="nb-card">
      <div className="nb-card-title">Assinatura</div>
      <CreditsBadge access={profile} />

      {isLicencaAvulsa ? (
        <p className="mb-3 text-[0.84rem] text-[var(--text-soft)]">
          Licença avulsa (Pix) válida até <b className="text-[var(--text)]">{formatDate(profile.licencaAvulsaExpiraEm!)}</b>. Pague de
          novo antes de vencer pra continuar com o Pro sem interrupção.
        </p>
      ) : (
        <SubscriptionDetails />
      )}
    </div>
  )
}

function FreePlanCard() {
  return (
    <div className="nb-card">
      <div className="nb-card-title">Assinatura</div>
      <p className="mb-3 text-[0.84rem] text-[var(--text-soft)]">
        Assine o Pro e desbloqueie descrever refeições com IA (texto e voz), chat nutricional e insights personalizados.
      </p>
      <PlanSelector />
    </div>
  )
}
