import { useState } from 'react'
import { openBillingPortal, mapBillingErrorCode, BillingError } from '../lib/billing'
import { CreditsBadge } from './CreditsBadge'
import { PlanSelector } from './PlanSelector'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isLicencaAvulsa = !!profile.licencaAvulsaExpiraEm

  async function handleManage() {
    setLoading(true)
    setError(null)
    try {
      await openBillingPortal()
    } catch (err) {
      setError(err instanceof BillingError ? mapBillingErrorCode(err.code, err.message) : mapBillingErrorCode('upstream_error'))
      setLoading(false)
    }
  }

  return (
    <div className="nb-card">
      <div className="nb-card-title">Assinatura</div>
      <CreditsBadge access={profile} />

      {isLicencaAvulsa ? (
        <>
          <p className="mb-3 text-[0.84rem] text-[var(--text-soft)]">
            Licença avulsa (Pix) válida até <b className="text-[var(--text)]">{formatDate(profile.licencaAvulsaExpiraEm!)}</b>. Pague de
            novo antes de vencer pra continuar com o Pro sem interrupção.
          </p>
        </>
      ) : (
        <>
          {error && <div className="mb-3 text-[0.8rem] text-[var(--coral)]">{error}</div>}
          <button type="button" onClick={handleManage} disabled={loading} className="nb-btn nb-btn-secondary w-full py-2.5">
            {loading ? 'Abrindo…' : 'Gerenciar assinatura'}
          </button>
          <p className="mt-2 text-[0.74rem] text-[var(--text-soft)]">
            Trocar cartão, ver faturas ou cancelar — tudo direto com o Stripe, com segurança.
          </p>
        </>
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
