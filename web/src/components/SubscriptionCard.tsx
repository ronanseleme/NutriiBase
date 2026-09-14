import { useEffect, useState } from 'react'
import { listPlans, startCheckout, openBillingPortal, mapBillingErrorCode, BillingError, type Plan } from '../lib/billing'
import { CreditsBadge } from './CreditsBadge'
import type { Profile } from '../types'

function formatPrice(plan: Plan): string {
  const value = plan.unitAmount / 100
  const amount = value.toLocaleString('pt-BR', { style: 'currency', currency: plan.currency })
  if (plan.intervalCount === 1) {
    return `${amount} /${plan.interval === 'year' ? 'ano' : 'mês'}`
  }
  const unit = plan.interval === 'year' ? 'ano' : 'mês'
  const unitPlural = plan.interval === 'year' ? 'anos' : 'meses'
  return `${amount} a cada ${plan.intervalCount} ${plan.intervalCount === 1 ? unit : unitPlural}`
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
      {error && <div className="mb-3 text-[0.8rem] text-[var(--coral)]">{error}</div>}
      <button type="button" onClick={handleManage} disabled={loading} className="nb-btn nb-btn-secondary w-full py-2.5">
        {loading ? 'Abrindo…' : 'Gerenciar assinatura'}
      </button>
      <p className="mt-2 text-[0.74rem] text-[var(--text-soft)]">
        Trocar cartão, ver faturas ou cancelar — tudo direto com o Stripe, com segurança.
      </p>
    </div>
  )
}

function FreePlanCard() {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPlans()
      .then((p) => {
        setPlans(p)
        const anual = p.find((x) => x.intervalCount === 12 || x.interval === 'year')
        setSelected((anual || p[0])?.priceId ?? null)
      })
      .catch(() => setLoadError(true))
  }, [])

  async function handleSubscribe() {
    if (!selected) return
    setStarting(true)
    setError(null)
    try {
      await startCheckout(selected)
    } catch (err) {
      setError(err instanceof BillingError ? mapBillingErrorCode(err.code, err.message) : mapBillingErrorCode('upstream_error'))
      setStarting(false)
    }
  }

  return (
    <div className="nb-card">
      <div className="nb-card-title">Assinatura</div>
      <p className="mb-3 text-[0.84rem] text-[var(--text-soft)]">
        Assine o Pro e desbloqueie descrever refeições com IA (texto e voz), chat nutricional e insights personalizados.
      </p>

      {loadError && (
        <div className="mb-3 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] p-2.5 text-[0.82rem] text-[var(--coral)]">
          Não foi possível carregar os planos agora. Tente novamente mais tarde.
        </div>
      )}
      {!plans && !loadError && <p className="mb-3 text-[0.82rem] text-[var(--text-soft)]">Carregando planos…</p>}

      {plans && (
        <div className="mb-3 flex flex-col gap-2">
          {plans.map((plan) => (
            <button
              key={plan.priceId}
              type="button"
              onClick={() => setSelected(plan.priceId)}
              className={`flex items-center justify-between rounded-[12px] border px-3.5 py-2.5 text-left transition-all ${
                selected === plan.priceId
                  ? 'border-transparent bg-[image:var(--brand-gradient)] text-white'
                  : 'border-[var(--line-strong)] bg-[var(--bg)]'
              }`}
            >
              <span className="font-bold">{plan.label}</span>
              <span className={`text-[0.82rem] font-semibold ${selected === plan.priceId ? 'text-white/90' : 'text-[var(--text-soft)]'}`}>
                {formatPrice(plan)}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="mb-3 text-[0.8rem] text-[var(--coral)]">{error}</div>}

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={!selected || starting}
        className="nb-btn nb-btn-primary w-full py-2.5"
      >
        {starting ? 'Abrindo pagamento…' : 'Assinar Pro'}
      </button>
    </div>
  )
}
