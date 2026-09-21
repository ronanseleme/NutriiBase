// Vercel Serverless Function: create-pix (POST /api/payments/create-pix)
//
// Usuário logado escolhe um plano (mensal/trimestral/semestral/anual) e
// essa função cria uma order Pix na API de Orders do Mercado Pago. A
// confirmação de pagamento de verdade acontece depois, via
// mercadopago-webhook.js — aqui só devolvemos o QR code pra pessoa pagar.
//
// userId e email vêm do token de sessão do Supabase (Authorization
// header), nunca do corpo da requisição — evita que alguém crie uma order
// em nome de outro usuário só mandando um userId diferente. O valor
// cobrado (amount) também não vem do cliente: é buscado em tempo real na
// Edge Function list-plans (mesma fonte de preços que o Stripe já usa),
// pra ninguém conseguir pagar um plano Pro por um valor arbitrário.
//
// Env vars (Vercel → Settings → Environment Variables):
//   MERCADOPAGO_ACCESS_TOKEN
//   VITE_SUPABASE_URL          (a mesma usada pelo frontend)
//   VITE_SUPABASE_ANON_KEY     (a mesma usada pelo frontend)
//   SUPABASE_SERVICE_ROLE_KEY

import crypto from 'node:crypto'
import { getSupabaseAdmin, getSupabaseAsUser } from '../_shared/supabaseAdmin.js'
import { PLAN_DAYS } from '../_shared/plans.js'

const MERCADOPAGO_ORDERS_URL = 'https://api.mercadopago.com/v1/orders'
const PIX_EXPIRATION_MINUTES = 30

async function fetchPlanPrice(planCode) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const days = PLAN_DAYS[planCode]

  const res = await fetch(`${supabaseUrl}/functions/v1/list-plans`, {
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  const plans = data?.plans
  if (!Array.isArray(plans)) return null

  const plan = plans.find((p) => p.days === days)
  if (!plan?.oneTime) return null
  return plan.oneTime
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Faça login para assinar.' })
  }
  const supabaseAsUser = getSupabaseAsUser(authHeader)
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser()
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' })
  }
  const userId = userData.user.id
  const payerEmail = userData.user.email
  if (!payerEmail) {
    return res.status(400).json({ error: 'Sua conta não tem e-mail cadastrado.' })
  }

  const { plan } = req.body || {}
  if (!plan || !(plan in PLAN_DAYS)) {
    return res.status(400).json({ error: 'Plano inválido.' })
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('create-pix: MERCADOPAGO_ACCESS_TOKEN não configurada.')
    return res.status(500).json({ error: 'Pagamento não configurado no servidor.' })
  }

  const price = await fetchPlanPrice(plan)
  if (!price) {
    return res.status(400).json({ error: 'Esse plano não tem opção de pagamento avulso (Pix) configurada.' })
  }
  const amountFormatted = (price.unitAmount / 100).toFixed(2)
  const externalReference = `pix-${userId}-${Date.now()}`

  const orderPayload = {
    type: 'online',
    processing_mode: 'automatic',
    total_amount: amountFormatted,
    external_reference: externalReference,
    payer: { email: payerEmail },
    transactions: {
      payments: [
        {
          amount: amountFormatted,
          payment_method: {
            id: 'pix',
            type: 'bank_transfer',
          },
        },
      ],
    },
    expiration_time: `PT${PIX_EXPIRATION_MINUTES}M`,
  }

  let mpResponse
  try {
    mpResponse = await fetch(MERCADOPAGO_ORDERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(orderPayload),
    })
  } catch (err) {
    console.error('create-pix: falha ao chamar a API do Mercado Pago', err)
    return res.status(502).json({ error: 'Não foi possível conectar ao Mercado Pago.' })
  }

  const mpData = await mpResponse.json().catch(() => null)
  if (!mpResponse.ok || !mpData) {
    console.error('create-pix: Mercado Pago recusou a order', mpResponse.status, mpData)
    return res.status(502).json({ error: 'Mercado Pago recusou a criação do pedido Pix.' })
  }

  const payment = mpData.transactions?.payments?.[0]
  const qrCode = payment?.payment_method?.qr_code ?? null
  const qrCodeBase64 = payment?.payment_method?.qr_code_base64 ?? null
  const orderId = mpData.id ?? null

  if (!orderId || !qrCode) {
    console.error('create-pix: resposta do Mercado Pago sem id/qr_code', mpData)
    return res.status(502).json({ error: 'Resposta inesperada do Mercado Pago.' })
  }

  const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60_000).toISOString()

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error: insertError } = await supabaseAdmin.from('pix_orders').insert({
      user_id: userId,
      plan_code: plan,
      amount: amountFormatted,
      payer_email: payerEmail,
      mp_order_id: orderId,
      external_reference: externalReference,
      status: 'pending',
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
    })
    if (insertError) {
      console.error('create-pix: falha ao registrar em pix_orders', insertError)
      return res.status(500).json({ error: 'Pedido criado no Mercado Pago, mas falhou ao registrar no banco.' })
    }
  } catch (err) {
    console.error('create-pix: erro inesperado ao registrar pedido', err)
    return res.status(500).json({ error: 'Pedido criado no Mercado Pago, mas falhou ao registrar no banco.' })
  }

  return res.status(200).json({ orderId, status: 'pending', qrCode, qrCodeBase64, expiresAt })
}
