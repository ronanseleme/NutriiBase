// Vercel Serverless Function: system-status (GET /api/system-status)
//
// Painel de status (Admin > Status) chama isso pra checar as peças que só
// existem do lado da Vercel — hoje só o Mercado Pago, cujo access token só
// mora aqui (nunca no Supabase). O resto (Postgres, Storage, Auth, Stripe,
// Gemini) é checado direto pela Edge Function system-status do Supabase; o
// frontend junta os dois resultados num painel só.
//
// Só admin pode chamar — bate na API de verdade do Mercado Pago.
//
// Env vars: MERCADOPAGO_ACCESS_TOKEN, VITE_SUPABASE_URL,
//           VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { getSupabaseAdmin, getSupabaseAsUser } from './_shared/supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Use GET.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Faça login para ver o status.' })
  }

  const supabaseAsUser = getSupabaseAsUser(authHeader)
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser()
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: profileRow, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()
  if (profileError || !profileRow) {
    return res.status(500).json({ error: 'Não foi possível verificar seu acesso.' })
  }
  if (profileRow.role !== 'admin') {
    return res.status(403).json({ error: 'Restrito a administradores.' })
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  const start = Date.now()
  let check

  if (!accessToken) {
    check = {
      key: 'mercadopago',
      label: 'Mercado Pago (Pix)',
      status: 'error',
      latencyMs: null,
      message: 'MERCADOPAGO_ACCESS_TOKEN não configurada.',
    }
  } else {
    try {
      const mpRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const latencyMs = Date.now() - start
      if (!mpRes.ok) {
        check = {
          key: 'mercadopago',
          label: 'Mercado Pago (Pix)',
          status: 'error',
          latencyMs,
          message: `Mercado Pago respondeu ${mpRes.status}`,
        }
      } else {
        const mode = accessToken.startsWith('APP_USR-') ? 'produção' : accessToken.startsWith('TEST-') ? 'teste' : 'desconhecido'
        check = {
          key: 'mercadopago',
          label: 'Mercado Pago (Pix)',
          status: 'ok',
          latencyMs,
          message: `Credenciais de ${mode}`,
        }
      }
    } catch (err) {
      check = {
        key: 'mercadopago',
        label: 'Mercado Pago (Pix)',
        status: 'error',
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : 'Falha desconhecida.',
      }
    }
  }

  return res.status(200).json({ checks: [check], checkedAt: new Date().toISOString() })
}
