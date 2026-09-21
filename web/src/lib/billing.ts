import { supabase } from './supabase'

export interface PriceInfo {
  priceId: string
  unitAmount: number
  currency: string
}
export interface RecurringPriceInfo extends PriceInfo {
  interval: string
  intervalCount: number
}
export interface Plan {
  productId: string
  label: string
  days: number
  recurring: RecurringPriceInfo | null
  oneTime: PriceInfo | null
}

export interface InvoiceInfo {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
}
export interface SubscriptionDetails {
  status: string
  planLabel: string
  amount: number | null
  currency: string
  interval: string | null
  intervalCount: number | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null
  invoices: InvoiceInfo[]
}

export class BillingError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

async function unwrap<T>(promise: Promise<{ data: any; error: any }>): Promise<T> {
  const { data, error } = await promise
  if (error) {
    const ctx = (error as { context?: Response }).context
    let code = 'upstream_error'
    let message = error.message
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json()
        code = body?.error?.code || code
        message = body?.error?.message || message
      } catch {
        // corpo não era JSON — mantém o fallback
      }
    }
    throw new BillingError(message, code)
  }
  return data as T
}

export async function listPlans(): Promise<Plan[]> {
  const data = await unwrap<{ plans: Plan[] }>(supabase.functions.invoke('list-plans', { method: 'GET' }))
  return data.plans
}

export async function startCheckout(priceId: string, mode: 'subscription' | 'payment' = 'subscription'): Promise<void> {
  // Mesmo padrão do redirectTo do Google OAuth (useAuth.ts) — origin +
  // pathname sempre reflete a URL real da página, funciona em qualquer
  // domínio. NUNCA usar import.meta.env.BASE_URL aqui: com o base: './'
  // do vite.config.ts, isso vale a string literal "./", e concatenado
  // direto no fim da origin (sem separador) gera uma URL inválida como
  // "https://nutriibase.com.br./" — foi exatamente isso que quebrava o
  // redirecionamento pós-pagamento.
  const appUrl = window.location.origin + window.location.pathname
  const successUrl = `${appUrl}?checkout=success`
  const data = await unwrap<{ url: string }>(
    supabase.functions.invoke('create-checkout-session', {
      body: { priceId, mode, successUrl, cancelUrl: appUrl },
    }),
  )
  window.location.href = data.url
}

export async function openBillingPortal(): Promise<void> {
  const origin = window.location.origin + window.location.pathname
  const data = await unwrap<{ url: string }>(
    supabase.functions.invoke('create-portal-session', { body: { returnUrl: origin } }),
  )
  // Nova aba, não navega pra fora do app — trocar cartão ainda depende do
  // formulário seguro hospedado pelo Stripe (não temos Stripe Elements
  // embutido aqui), mas o site continua aberto por trás.
  window.open(data.url, '_blank', 'noopener,noreferrer')
}

export async function getSubscriptionDetails(): Promise<SubscriptionDetails> {
  return unwrap<SubscriptionDetails>(supabase.functions.invoke('subscription-details', { method: 'GET' }))
}

export async function manageSubscription(action: 'cancel' | 'reactivate'): Promise<{ cancelAtPeriodEnd: boolean }> {
  return unwrap<{ cancelAtPeriodEnd: boolean }>(
    supabase.functions.invoke('manage-subscription', { body: { action } }),
  )
}

export function mapBillingErrorCode(code: string, serverMessage?: string): string {
  if (serverMessage && code !== 'upstream_error') return serverMessage
  const map: Record<string, string> = {
    unauthorized: 'Sua sessão expirou — faça login de novo.',
    bad_request: 'Não foi possível processar essa solicitação.',
    no_subscription: 'Você ainda não tem uma assinatura ativa.',
    upstream_error: 'Problema temporário ao falar com a cobrança. Tente novamente.',
  }
  return map[code] || 'Não foi possível completar essa ação agora.'
}
