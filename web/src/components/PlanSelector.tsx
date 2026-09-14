import { useEffect, useState } from 'react'
import {
  listPlans,
  startCheckout,
  mapBillingErrorCode,
  BillingError,
  type Plan,
  type PriceInfo,
  type RecurringPriceInfo,
} from '../lib/billing'

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

// Escolha de plano (cartão recorrente ou Pix avulso) + botões de checkout.
// Reaproveitado tanto no card "Assinatura" do Perfil (usuário Free já
// logado, decide assinar depois) quanto no passo 3 do onboarding (conta
// recém-criada, decide na hora). O "footer" é onde cada chamador encaixa
// uma ação extra (ex: "Continuar no Free" só existe no onboarding).
export function PlanSelector({ footer }: { footer?: React.ReactNode }) {
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
    <>
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
      {footer}
    </>
  )
}
