// Vercel Serverless Function: status (GET /api/payments/status?orderId=...)
//
// Devolve o status atual de um pedido Pix, lido direto de pix_orders — não
// consulta o Mercado Pago de novo, o webhook (mercadopago-webhook.js) já
// mantém essa tabela atualizada. Usado pelo frontend pra fazer polling
// enquanto a tela do QR Code está aberta.
//
// Autentica com o Authorization header do usuário logado (não Service
// Role) — a policy pix_orders_select_own do RLS já garante que cada
// pessoa só enxerga os próprios pedidos, então nem precisa checar
// user_id manualmente aqui: se o pedido não for dela, a query volta vazia.
//
// Env vars (Vercel → Settings → Environment Variables):
//   VITE_SUPABASE_URL          (a mesma usada pelo frontend)
//   VITE_SUPABASE_ANON_KEY     (a mesma usada pelo frontend)

import { getSupabaseAsUser } from '../_shared/supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Use GET.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Faça login para consultar esse pedido.' })
  }

  const orderId = req.query?.orderId
  if (!orderId) {
    return res.status(400).json({ error: 'Falta orderId.' })
  }

  const supabaseAsUser = getSupabaseAsUser(authHeader)
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser()
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' })
  }

  const { data, error } = await supabaseAsUser.from('pix_orders').select('status').eq('mp_order_id', orderId).maybeSingle()
  if (error) {
    console.error('payments/status: falha ao consultar pix_orders', orderId, error)
    return res.status(500).json({ error: 'Não foi possível consultar o status agora.' })
  }
  if (!data) {
    return res.status(404).json({ error: 'Pedido não encontrado.' })
  }

  return res.status(200).json({ status: data.status })
}
