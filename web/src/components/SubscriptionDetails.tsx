import { useEffect, useState } from 'react'
import {
  getSubscriptionDetails,
  manageSubscription,
  openBillingPortal,
  mapBillingErrorCode,
  BillingError,
  type SubscriptionDetails as SubscriptionDetailsData,
} from '../lib/billing'
import { formatCurrency } from './PlanSelector'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(iso))
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativa',
  trialing: 'Em teste',
  past_due: 'Pagamento pendente',
  unpaid: 'Pagamento pendente',
  canceled: 'Cancelada',
  incomplete: 'Pagamento pendente',
  incomplete_expired: 'Expirada',
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  paid: 'Paga',
  open: 'Em aberto',
  void: 'Anulada',
  uncollectible: 'Não cobrada',
  draft: 'Rascunho',
}

// Mostra os dados da assinatura recorrente (plano, cartão, faturas) direto
// no app — evita mandar a pessoa pro Portal do Cliente do Stripe só pra
// ela ver essas infos. Trocar de cartão ainda abre o Stripe (não temos
// Stripe Elements embutido), mas numa aba nova, sem sair do site.
export function SubscriptionDetails() {
  const [data, setData] = useState<SubscriptionDetailsData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'cancel' | 'reactivate' | 'card' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  function load() {
    setLoadError(null)
    getSubscriptionDetails()
      .then(setData)
      .catch((err) =>
        setLoadError(err instanceof BillingError ? mapBillingErrorCode(err.code, err.message) : mapBillingErrorCode('upstream_error')),
      )
  }

  useEffect(load, [])

  async function handleCancelToggle(action: 'cancel' | 'reactivate') {
    setBusy(action)
    setActionError(null)
    try {
      await manageSubscription(action)
      setConfirmingCancel(false)
      load()
    } catch (err) {
      setActionError(err instanceof BillingError ? mapBillingErrorCode(err.code, err.message) : mapBillingErrorCode('upstream_error'))
    } finally {
      setBusy(null)
    }
  }

  async function handleChangeCard() {
    setBusy('card')
    setActionError(null)
    try {
      await openBillingPortal()
    } catch (err) {
      setActionError(err instanceof BillingError ? mapBillingErrorCode(err.code, err.message) : mapBillingErrorCode('upstream_error'))
    } finally {
      setBusy(null)
    }
  }

  if (loadError) {
    return <div className="text-[0.8rem] text-[var(--coral)]">{loadError}</div>
  }
  if (!data) {
    return <p className="text-[0.82rem] text-[var(--text-soft)]">Carregando assinatura…</p>
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-[12px] border border-[var(--line-strong)] bg-[var(--bg)] px-3.5 py-3">
        <div>
          <div className="font-bold">{data.planLabel}</div>
          <div className="text-[0.78rem] text-[var(--text-soft)]">
            {data.amount != null && formatCurrency(data.amount, data.currency)}
            {data.interval && ` /${data.interval === 'year' ? 'ano' : 'mês'}`}
          </div>
        </div>
        <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[0.72rem] font-bold text-[var(--text-soft)]">
          {STATUS_LABEL[data.status] || data.status}
        </span>
      </div>

      {data.cancelAtPeriodEnd ? (
        <div className="mb-3 rounded-[10px] border border-[color-mix(in_srgb,var(--orange)_35%,transparent)] bg-[color-mix(in_srgb,var(--orange)_10%,var(--surface))] px-3 py-2.5 text-[0.8rem] text-[var(--text)]">
          Sua assinatura vai encerrar em{' '}
          <b>{data.currentPeriodEnd && formatDate(data.currentPeriodEnd)}</b> — você continua Pro até lá, mas não será cobrado de novo.
        </div>
      ) : (
        data.currentPeriodEnd && (
          <p className="mb-3 text-[0.8rem] text-[var(--text-soft)]">
            Próxima cobrança em <b className="text-[var(--text)]">{formatDate(data.currentPeriodEnd)}</b>.
          </p>
        )
      )}

      {data.paymentMethod && (
        <div className="mb-3 flex items-center justify-between text-[0.82rem]">
          <span className="text-[var(--text-soft)]">Forma de pagamento</span>
          <span className="font-semibold capitalize">
            {data.paymentMethod.brand} •••• {data.paymentMethod.last4} · vence{' '}
            {String(data.paymentMethod.expMonth).padStart(2, '0')}/{data.paymentMethod.expYear}
          </span>
        </div>
      )}

      {actionError && <div className="mb-3 text-[0.8rem] text-[var(--coral)]">{actionError}</div>}

      <div className="flex flex-col gap-2">
        <button type="button" onClick={handleChangeCard} disabled={!!busy} className="nb-btn nb-btn-secondary w-full py-2.5">
          {busy === 'card' ? 'Abrindo…' : 'Trocar cartão'}
        </button>

        {data.cancelAtPeriodEnd ? (
          <button
            type="button"
            onClick={() => handleCancelToggle('reactivate')}
            disabled={!!busy}
            className="nb-btn nb-btn-primary w-full py-2.5"
          >
            {busy === 'reactivate' ? 'Reativando…' : 'Reativar assinatura'}
          </button>
        ) : confirmingCancel ? (
          <div className="rounded-[10px] border border-[var(--line-strong)] p-2.5">
            <p className="mb-2 text-[0.8rem] text-[var(--text-soft)]">
              Cancelar agora? Você continua Pro até {data.currentPeriodEnd && formatDate(data.currentPeriodEnd)}, sem nova cobrança depois.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={!!busy}
                className="nb-btn nb-btn-secondary flex-1 py-2"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => handleCancelToggle('cancel')}
                disabled={!!busy}
                className="nb-btn flex-1 py-2 text-white"
                style={{ background: 'var(--coral)' }}
              >
                {busy === 'cancel' ? 'Cancelando…' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingCancel(true)} className="py-1 text-center text-[0.8rem] font-semibold text-[var(--text-soft)] underline underline-offset-2">
            Cancelar assinatura
          </button>
        )}
      </div>

      {data.invoices.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[0.78rem] font-bold text-[var(--text-soft)]">Faturas</div>
          <div className="flex flex-col gap-1.5">
            {data.invoices.map((inv) => (
              <a
                key={inv.id}
                href={inv.hostedInvoiceUrl ?? inv.invoicePdf ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-[10px] border border-[var(--line-strong)] px-3 py-2 text-[0.8rem] hover:bg-[var(--bg)]"
              >
                <span>{formatDate(inv.date)}</span>
                <span className="font-semibold">{formatCurrency(inv.amount, inv.currency)}</span>
                <span className="text-[0.72rem] text-[var(--text-soft)]">{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
