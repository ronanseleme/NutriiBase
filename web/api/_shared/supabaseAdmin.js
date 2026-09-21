// Cliente Supabase com Service Role Key — ignora RLS, só pra uso em
// Serverless Functions server-side (nunca no frontend). Compartilhado
// entre create-pix.js, status.js e mercadopago-webhook.js.
import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nas env vars do servidor.')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

// Cliente Supabase autenticado como o usuário logado (via o Authorization
// header que o frontend manda), pra RLS decidir o que ele pode ver — usado
// em endpoints que precisam saber QUEM está chamando (create-pix, status)
// sem confiar em um userId que o próprio cliente poderia forjar.
export function getSupabaseAsUser(authHeader) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nas env vars do servidor.')
  }
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}
