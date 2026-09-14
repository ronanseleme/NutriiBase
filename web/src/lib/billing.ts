import { supabase } from './supabase'

export interface Plan {
  productId: string
  priceId: string
  label: string
  unitAmount: number
  currency: string
  interval: string
  intervalCount: number
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

export async function startCheckout(priceId: string): Promise<void> {
  const origin = window.location.origin + import.meta.env.BASE_URL
  const data = await unwrap<{ url: string }>(
    supabase.functions.invoke('create-checkout-session', {
      body: { priceId, successUrl: origin, cancelUrl: origin },
    }),
  )
  window.location.href = data.url
}

export async function openBillingPortal(): Promise<void> {
  const origin = window.location.origin + import.meta.env.BASE_URL
  const data = await unwrap<{ url: string }>(
    supabase.functions.invoke('create-portal-session', { body: { returnUrl: origin } }),
  )
  window.location.href = data.url
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
