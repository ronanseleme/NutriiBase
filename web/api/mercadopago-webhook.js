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

import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago'
import { getSupabaseAdmin } from './_shared/supabaseAdmin.js'
import { PLAN_DAYS } from './_shared/plans.js'

const MERCADOPAGO_ORDERS_URL = 'https://api.mercadopago.com/v1/orders'

// pix_orders.status só usa este vocabulário (o mesmo que GET
// /api/payments/status devolve pro frontend) — nunca a string crua que o
// Mercado Pago manda, que inclui as duas grafias "canceled"/"cancelled".
const FAILED_MP_STATUSES = new Set(['canceled', 'cancelled', 'failed'])

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
    // O SDK oficial (WebhookSignatureValidator) NÃO faz lowercase do
    // dataId antes de montar o manifest — mas a doc do Mercado Pago exige
    // isso quando o id vem com letras maiúsculas (ex: "ORD01JQ4S4KY..."),
    // que é o formato real de todo order id da API de Orders. Sem esse
    // lowercase aqui, a assinatura de qualquer notificação real nunca
    // bateria e todo pagamento seria rejeitado com 401.
    WebhookSignatureValidator.validate({
      xSignature: req.headers['x-signature'],
      xRequestId: req.headers['x-request-id'],
      dataId: req.query['data.id']?.toLowerCase(),
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
      // paid_at se o mesmo evento chegar duplicado. .select() devolve a
      // linha atualizada pra sabermos quem ativar (null se já tinha virado
      // "paid" antes, aí não ativa de novo).
      const { data: paidOrder, error: updateError } = await supabaseAdmin
        .from('pix_orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('mp_order_id', orderId)
        .eq('status', 'pending')
        .select('user_id, plan_code')
        .maybeSingle()
      if (updateError) {
        console.error('mercadopago-webhook: falha ao atualizar pix_orders', orderId, updateError)
      } else if (paidOrder) {
        // Reaproveita a mesma RPC do fluxo de Pix via Stripe (o nome ficou
        // "stripe_" por histórico, mas o comportamento é genérico: só seta
        // role/créditos/vencimento — não depende de nada específico do
        // Stripe) em vez de duplicar essa lógica de negócio aqui.
        const dias = PLAN_DAYS[paidOrder.plan_code] ?? 30
        const { error: activateError } = await supabaseAdmin.rpc('stripe_activate_pro_avulso', {
          target_user: paidOrder.user_id,
          dias,
        })
        if (activateError) {
          console.error('mercadopago-webhook: falha ao ativar Pro', orderId, paidOrder.user_id, activateError)
        }
      }
    } catch (err) {
      console.error('mercadopago-webhook: erro inesperado ao atualizar pedido', orderId, err)
    }
  } else if (mpData.status === 'expired' || FAILED_MP_STATUSES.has(mpData.status)) {
    // A order Pix não vai mais virar pagamento — encerra o pedido em vez
    // de deixá-lo preso em "pending" pra sempre. Normaliza pro vocabulário
    // local (pending/paid/expired/failed) — nunca grava a string crua do
    // Mercado Pago, que tem duas grafias possíveis pra cancelamento.
    const localStatus = mpData.status === 'expired' ? 'expired' : 'failed'
    try {
      const supabaseAdmin = getSupabaseAdmin()
      const { error: updateError } = await supabaseAdmin
        .from('pix_orders')
        .update({ status: localStatus })
        .eq('mp_order_id', orderId)
        .eq('status', 'pending')
      if (updateError) {
        console.error('mercadopago-webhook: falha ao marcar pix_orders como', localStatus, orderId, updateError)
      }
    } catch (err) {
      console.error('mercadopago-webhook: erro inesperado ao encerrar pedido', orderId, err)
    }
  }

  return res.status(200).json({ received: true })
}
