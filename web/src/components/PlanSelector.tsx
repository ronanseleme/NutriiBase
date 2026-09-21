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
import { PixPaymentModal } from './PixPaymentModal'
import type { PixPlanCode } from '../lib/pixPayment'

export function formatCurrency(cents: number, currency: string): string {
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

// Dá pra chegar aqui com um plano específico já escolhido lá na landing
// page (ex: a pessoa selecionou "Trimestral" antes de clicar em assinar).
// A intenção fica em localStorage (não dá pra confiar na query string —
// some no roundtrip de confirmação de e-mail / OAuth do Google).
const PLANO_HINT_DAYS: Record<string, number> = { mensal: 30, trimestral: 90, semestral: 180, anual: 365 }

// Inverso de PLANO_HINT_DAYS — pra saber que código de plano mandar pro
// endpoint do Pix (Mercado Pago) a partir do plano do Stripe selecionado
// na tela (que só sabe o productId/days, não esse código).
const DAYS_TO_PLAN_CODE: Record<number, PixPlanCode> = { 30: 'mensal', 90: 'trimestral', 180: 'semestral', 365: 'anual' }

function consumePlanoHintDays(): number | null {
  const plano = localStorage.getItem('nb_plano')
  if (!plano) return null
  localStorage.removeItem('nb_plano')
  return PLANO_HINT_DAYS[plano] ?? null
}

// Escolha de plano (cartão recorrente via Stripe ou Pix avulso via
// Mercado Pago) + botões de checkout. Reaproveitado tanto no card
// "Assinatura" do Perfil (usuário Free já logado, decide assinar depois)
// quanto no passo 3 do onboarding (conta recém-criada, decide na hora). O
// "footer" é onde cada chamador encaixa uma ação extra (ex: "Continuar no
// Free" só existe no onboarding). onProfileRefresh é chamado assim que um
// pagamento Pix confirma, pra profile.role virar "pro" na hora sem reload.
export function PlanSelector({ footer, onProfileRefresh }: { footer?: React.ReactNode; onProfileRefresh?: () => void }) {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [starting, setStarting] = useState<'card' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPixModal, setShowPixModal] = useState(false)

  useEffect(() => {
    listPlans()
      .then((p) => {
        setPlans(p)
        const hintDays = consumePlanoHintDays()
        const hinted = hintDays != null ? p.find((x) => x.days === hintDays) : null
        const anual = p.find((x) => x.recurring?.intervalCount === 12 || x.recurring?.interval === 'year')
        setSelected((hinted || anual || p[0])?.productId ?? null)
      })
      .catch(() => setLoadError(true))
  }, [])

  const selectedPlan = plans?.find((p) => p.productId === selected) ?? null
  const pixPlanCode = selectedPlan ? DAYS_TO_PLAN_CODE[selectedPlan.days] : undefined
  // O Pix (Mercado Pago) usa o valor do preço recorrente como base — não
  // depende de existir um preço "avulso" separado no Stripe, que só fazia
  // sentido quando o Pix passava pelo Checkout do próprio Stripe.
  const pixPriceLabel = selectedPlan?.recurring
    ? formatCurrency(selectedPlan.recurring.unitAmount, selectedPlan.recurring.currency)
    : null

  async function handleSubscribeCard() {
    const priceId = selectedPlan?.recurring?.priceId
    if (!priceId) return
    setStarting('card')
    setError(null)
    try {
      await startCheckout(priceId, 'subscription')
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
            onClick={handleSubscribeCard}
            disabled={!!starting}
            className="nb-btn nb-btn-primary w-full py-2.5"
          >
            {starting === 'card' ? 'Abrindo pagamento…' : 'Assinar com cartão'}
          </button>
        )}
        {pixPriceLabel && pixPlanCode && (
          <button
            type="button"
            onClick={() => setShowPixModal(true)}
            disabled={!!starting}
            className="nb-btn nb-btn-secondary w-full py-2.5"
          >
            {`Pagar com Pix · ${pixPriceLabel}`}
          </button>
        )}
      </div>
      {pixPriceLabel && (
        <p className="mt-2 text-[0.72rem] text-[var(--text-soft)]">
          Pix é pagamento único — libera o Pro por {selectedPlan!.days} dias, sem cobrança automática depois.
        </p>
      )}
      {footer}

      {showPixModal && pixPriceLabel && pixPlanCode && (
        <PixPaymentModal
          plan={pixPlanCode}
          planLabel={selectedPlan!.label}
          priceLabel={pixPriceLabel}
          onClose={() => setShowPixModal(false)}
          onProfileRefresh={() => onProfileRefresh?.()}
        />
      )}
    </>
  )
}
