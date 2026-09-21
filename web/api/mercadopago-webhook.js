// Vercel Serverless Function: mercadopago-webhook
//
// O Mercado Pago chama essa função sozinho quando uma order muda de
// estado. O corpo da notificação só traz { data: { id } } — precisamos
// consultar a order de verdade (GET /v1/orders/{id}) pra saber o status
// real, e só então marcar o pedido como pago em pix_orders.
//
// Antes de processar qualquer coisa, valida a assinatura HMAC-SHA256 do
// header x-signature — sem isso, qualquer um que descobrisse esta URL
// poderia forjar uma notificação de pagamento e liberar acesso Pro de
// graça. Ver verifyMercadoPagoSignature() abaixo.
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

// Formato do header x-signature: "ts=1704908010,v1=<hmac em hex>". O
// manifest assinado pelo Mercado Pago é "id:{data.id};request-id:{x-request-id};ts:{ts};"
// — id sempre em minúsculas. Recalcula o HMAC-SHA256 com o secret do
// webhook e compara com v1 em tempo constante (timingSafeEqual), pra não
// vazar informação sobre o quanto da assinatura bateu através do tempo
// de resposta.
function verifyMercadoPagoSignature(req, dataId) {
  // .trim() evita que um espaço ou quebra de linha acidental ao colar o
  // secret no painel do Vercel invalide toda assinatura em produção.
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
  const signatureHeader = req.headers['x-signature']
  const requestId = req.headers['x-request-id'] || ''

  if (!secret) {
    console.error('mercadopago-webhook: MERCADOPAGO_WEBHOOK_SECRET não configurada.')
    return false
  }
  if (!dataId) return false
  if (!signatureHeader) return false

  const parts = {}
  for (const chunk of String(signatureHeader).split(',')) {
    const separatorIndex = chunk.indexOf('=')
    if (separatorIndex === -1) continue
    const key = chunk.slice(0, separatorIndex).trim()
    const value = chunk.slice(separatorIndex + 1).trim()
    parts[key] = value
  }
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`
  const expectedHex = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  const expectedBuffer = Buffer.from(expectedHex, 'utf8')
  const receivedBuffer = Buffer.from(v1, 'utf8')
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }

  // data.id vem como query param nas notificações "topic"/webhooks
  // clássicos do Mercado Pago, e no corpo em outras — aceita os dois.
  const orderId = req.query?.['data.id'] || req.body?.data?.id

  if (!verifyMercadoPagoSignature(req, orderId)) {
    console.error('mercadopago-webhook: assinatura x-signature inválida ou ausente', orderId)
    return res.status(401).json({ error: 'Assinatura inválida.' })
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
