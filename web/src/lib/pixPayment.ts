import { supabase } from './supabase'

export type PixPlanCode = 'mensal' | 'trimestral' | 'semestral' | 'anual'
export type PixOrderStatus = 'pending' | 'paid' | 'expired' | 'failed'

export interface PixOrder {
  orderId: string
  status: PixOrderStatus
  qrCode: string
  qrCodeBase64: string
  expiresAt: string
}

export class PixPaymentError extends Error {}

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new PixPaymentError('Sua sessão expirou — faça login de novo.')
  return `Bearer ${token}`
}

async function unwrap<T>(res: Response): Promise<T> {
  let body: any = null
  try {
    body = await res.json()
  } catch {
    // corpo vazio ou não-JSON — mantém body null, cai no fallback abaixo
  }
  if (!res.ok) {
    throw new PixPaymentError(body?.error || 'Não foi possível completar essa ação agora.')
  }
  return body as T
}

export async function createPixOrder(plan: PixPlanCode): Promise<PixOrder> {
  const res = await fetch('/api/payments/create-pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({ plan }),
  })
  return unwrap<PixOrder>(res)
}

export async function getPixOrderStatus(orderId: string): Promise<PixOrderStatus> {
  const res = await fetch(`/api/payments/status?orderId=${encodeURIComponent(orderId)}`, {
    headers: { Authorization: await authHeader() },
  })
  const data = await unwrap<{ status: PixOrderStatus }>(res)
  return data.status
}
