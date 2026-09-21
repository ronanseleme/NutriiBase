// Vercel Serverless Function: mercadopago-webhook
//
// O Mercado Pago chama essa função sozinho quando uma order muda de
// estado. O corpo da notificação só traz { data: { id } } — precisamos
// consultar a order de verdade (GET /v1/orders/{id}) pra saber o status
// real, e só então marcar o pedido como pago em pix_orders.
//
// Antes de processar qualquer coisa, valida a assinatura do header
// x-signature com o validador oficial do SDK do Mercado Pago — sem isso,
// qualquer um que descobrisse esta URL poderia forjar uma notificação de
// pagamento e liberar acesso Pro de graça.
//
// Cadastre esta URL no Mercado Pago (Suas integrações → Webhooks):
//   https://<seu-dominio>/api/mercadopago-webhook
//
// Env vars (Vercel → Settings → Environment Variables):
//   MERCADOPAGO_ACCESS_TOKEN
//   MERCADOPAGO_WEBHOOK_SECRET (chave secreta da assinatura, na mesma
//                               tela onde a URL do webhook foi cadastrada)
//   VITE_SUPABASE_URL          (a mesma usada pelo frontend)
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago'

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

  // data.id vem como query param nas notificações "topic"/webhooks
  // clássicos do Mercado Pago, e no corpo em outras — aceita os dois pro
  // lookup da order. A validação de assinatura abaixo usa só o query
  // param, que é o que o Mercado Pago realmente assina.
  const orderId = req.query?.['data.id'] || req.body?.data?.id

  // TODO: log temporário — se data.id não veio no query string (só no
  // body), o validador abaixo recebe dataId vazio e a assinatura nunca
  // bate. Ajuda a confirmar se isso acontece de verdade em produção.
  if (!req.query?.['data.id']) {
    console.log('DEBUG: data.id ausente no query string — req.query =', req.query, '| req.url =', req.url)
  }

  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers['x-signature'],
      xRequestId: req.headers['x-request-id'],
      dataId: req.query['data.id'],
      secret: process.env.MERCADOPAGO_WEBHOOK_SECRET.trim(),
    })
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      console.error('mercadopago-webhook: assinatura inválida', err.reason, orderId)
      return res.status(401).json({ error: 'invalid signature' })
    }
    throw err
  }

  if (!orderId) {
    // O Mercado Pago também manda notificações de teste sem data.id —
    // devolve 200 pra não gerar retentativa em cima de algo que nunca vai
    // ter id de order de verdade.
    return res.status(200).json({ received: true })
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('mercadopago-webhook: MERCADOPAGO_ACCESS_TOKEN não configurada.')
    return res.status(500).json({ error: 'Pagamento não configurado no servidor.' })
  }

  let mpData
  try {
    const mpResponse = await fetch(`${MERCADOPAGO_ORDERS_URL}/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    mpData = await mpResponse.json().catch(() => null)
    if (!mpResponse.ok || !mpData) {
      console.error('mercadopago-webhook: falha ao consultar a order', orderId, mpResponse.status, mpData)
      // Devolve 200 mesmo assim — se a consulta falhar de novo na próxima
      // retentativa do Mercado Pago, o log acima já registrou o problema.
      return res.status(200).json({ received: true })
    }
  } catch (err) {
    console.error('mercadopago-webhook: erro ao consultar Mercado Pago', orderId, err)
    return res.status(200).json({ received: true })
  }

  if (mpData.status === 'processed') {
    try {
      const supabaseAdmin = getSupabaseAdmin()
      // Só transiciona pedidos ainda "pending" — evita sobrescrever
      // paid_at se o mesmo evento chegar duplicado.
      const { error: updateError } = await supabaseAdmin
        .from('pix_orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('mp_order_id', orderId)
        .eq('status', 'pending')
      if (updateError) {
        console.error('mercadopago-webhook: falha ao atualizar pix_orders', orderId, updateError)
      }
    } catch (err) {
      console.error('mercadopago-webhook: erro inesperado ao atualizar pedido', orderId, err)
    }
  }

  return res.status(200).json({ received: true })
}
