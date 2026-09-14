import { useEffect, useState } from 'react'
import {
  listPlans,
  startCheckout,
  openBillingPortal,
  mapBillingErrorCode,
  BillingError,
  type Plan,
  type PriceInfo,
  type RecurringPriceInfo,
} from '../lib/billing'
import { CreditsBadge } from './CreditsBadge'
import type { Profile } from '../types'

function formatCurrency(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency })
}

function formatRecurringPrice(price: RecurringPriceInfo): string {
  const amount = formatCurrency(price.unitAmount, price.currency)
  if (price.intervalCount === 1) {
    return `${amount} /${price.interval === 'year' ? 'ano' : 'mês'}`
  }
  const unit = price.interval === 'year' ? 'ano' : 'mês'
  const unitPlural = price.interval === 'year' ? 'anos' : 'meses'
  return `${amount} a cada ${price.intervalCount} ${price.intervalCount === 1 ? unit : unitPlural}`
}

function formatOneTimePrice(price: PriceInfo): string {
  return formatCurrency(price.unitAmount, price.currency)
}

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
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [starting, setStarting] = useState<'card' | 'pix' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPlans()
      .then((p) => {
        setPlans(p)
        const anual = p.find((x) => x.recurring?.intervalCount === 12 || x.recurring?.interval === 'year')
        setSelected((anual || p[0])?.productId ?? null)
      })
      .catch(() => setLoadError(true))
  }, [])

  const selectedPlan = plans?.find((p) => p.productId === selected) ?? null

  async function handleSubscribe(mode: 'subscription' | 'payment') {
    const priceId = mode === 'subscription' ? selectedPlan?.recurring?.priceId : selectedPlan?.oneTime?.priceId
    if (!priceId) return
    setStarting(mode === 'subscription' ? 'card' : 'pix')
    setError(null)
    try {
      await startCheckout(priceId, mode)
    } catch (err) {
      setError(err instanceof BillingError ? mapBillingErrorCode(err.code, err.message) : mapBillingErrorCode('upstream_error'))
      setStarting(null)
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
              key={plan.productId}
              type="button"
              onClick={() => setSelected(plan.productId)}
              className={`flex items-center justify-between rounded-[12px] border px-3.5 py-2.5 text-left transition-all ${
                selected === plan.productId
                  ? 'border-transparent bg-[image:var(--brand-gradient)] text-white'
                  : 'border-[var(--line-strong)] bg-[var(--bg)]'
              }`}
            >
              <span className="font-bold">{plan.label}</span>
              <span className={`text-[0.82rem] font-semibold ${selected === plan.productId ? 'text-white/90' : 'text-[var(--text-soft)]'}`}>
                {plan.recurring ? formatRecurringPrice(plan.recurring) : plan.oneTime ? formatOneTimePrice(plan.oneTime) : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="mb-3 text-[0.8rem] text-[var(--coral)]">{error}</div>}

      <div className="flex flex-col gap-2">
        {selectedPlan?.recurring && (
          <button
            type="button"
            onClick={() => handleSubscribe('subscription')}
            disabled={!!starting}
            className="nb-btn nb-btn-primary w-full py-2.5"
          >
            {starting === 'card' ? 'Abrindo pagamento…' : 'Assinar com cartão'}
          </button>
        )}
        {selectedPlan?.oneTime && (
          <button
            type="button"
            onClick={() => handleSubscribe('payment')}
            disabled={!!starting}
            className="nb-btn nb-btn-secondary w-full py-2.5"
          >
            {starting === 'pix' ? 'Abrindo pagamento…' : `Pagar com Pix · ${formatOneTimePrice(selectedPlan.oneTime)}`}
          </button>
        )}
      </div>
      {selectedPlan?.oneTime && (
        <p className="mt-2 text-[0.72rem] text-[var(--text-soft)]">
          Pix é pagamento único — libera o Pro por {selectedPlan.days} dias, sem cobrança automática depois.
        </p>
      )}
    </div>
  )
}
