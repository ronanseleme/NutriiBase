// Vercel Serverless Function: create-pix-order
//
// Recebe { userId, planCode, amount, payerEmail } do frontend, cria uma
// order Pix na API de Orders do Mercado Pago (POST /v1/orders) e registra
// um pedido pendente em pix_orders. A confirmação de pagamento de verdade
// acontece depois, via mercadopago-webhook.js — aqui só devolvemos o QR
// code pra pessoa pagar.
//
// Env vars (Vercel → Settings → Environment Variables):
//   MERCADOPAGO_ACCESS_TOKEN
//   VITE_SUPABASE_URL          (a mesma usada pelo frontend)
//   SUPABASE_SERVICE_ROLE_KEY

import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const MERCADOPAGO_ORDERS_URL = 'https://api.mercadopago.com/v1/orders'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nas env vars do servidor.')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }

  const { userId, planCode, amount, payerEmail } = req.body || {}
  if (!userId || !planCode || !amount || !payerEmail) {
    return res.status(400).json({ error: 'Faltam userId, planCode, amount ou payerEmail.' })
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('create-pix-order: MERCADOPAGO_ACCESS_TOKEN não configurada.')
    return res.status(500).json({ error: 'Pagamento não configurado no servidor.' })
  }

  const amountFormatted = Number(amount).toFixed(2)
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
    expiration_time: 'PT30M',
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
    console.error('create-pix-order: falha ao chamar a API do Mercado Pago', err)
    return res.status(502).json({ error: 'Não foi possível conectar ao Mercado Pago.' })
  }

  const mpData = await mpResponse.json().catch(() => null)
  if (!mpResponse.ok || !mpData) {
    console.error('create-pix-order: Mercado Pago recusou a order', mpResponse.status, mpData)
    return res.status(502).json({ error: 'Mercado Pago recusou a criação do pedido Pix.' })
  }

  const payment = mpData.transactions?.payments?.[0]
  const qrCode = payment?.payment_method?.qr_code ?? null
  const qrCodeBase64 = payment?.payment_method?.qr_code_base64 ?? null
  const orderId = mpData.id ?? null

  if (!orderId || !qrCode) {
    console.error('create-pix-order: resposta do Mercado Pago sem id/qr_code', mpData)
    return res.status(502).json({ error: 'Resposta inesperada do Mercado Pago.' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error: insertError } = await supabaseAdmin.from('pix_orders').insert({
      user_id: userId,
      plan_code: planCode,
      amount: amountFormatted,
      payer_email: payerEmail,
      mp_order_id: orderId,
      external_reference: externalReference,
      status: 'pending',
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
    })
    if (insertError) {
      console.error('create-pix-order: falha ao registrar em pix_orders', insertError)
      return res.status(500).json({ error: 'Pedido criado no Mercado Pago, mas falhou ao registrar no banco.' })
    }
  } catch (err) {
    console.error('create-pix-order: erro inesperado ao registrar pedido', err)
    return res.status(500).json({ error: 'Pedido criado no Mercado Pago, mas falhou ao registrar no banco.' })
  }

  return res.status(200).json({ orderId, qrCode, qrCodeBase64 })
}
