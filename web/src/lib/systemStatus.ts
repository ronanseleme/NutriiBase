import { supabase } from './supabase'

export type CheckStatus = 'ok' | 'error'

export interface StatusCheck {
  key: string
  label: string
  status: CheckStatus
  latencyMs: number | null
  message: string | null
}

export interface StorageBucketUsage {
  bucket: string
  bytes: number
  objects: number
}

export interface StorageUsage {
  dbBytes: number
  dbQuotaBytes: number
  storageBytes: number
  storageQuotaBytes: number
  buckets: StorageBucketUsage[]
}

export interface SystemStatusResult {
  checks: StatusCheck[]
  storage: StorageUsage | null
}

export class SystemStatusError extends Error {}

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new SystemStatusError('Sua sessão expirou — faça login de novo.')
  return `Bearer ${token}`
}

function errorCheck(key: string, label: string): StatusCheck {
  return { key, label, status: 'error', latencyMs: null, message: `Não foi possível consultar ${label}.` }
}

// Duas fontes: a Edge Function do Supabase checa o que roda do lado dela
// (Postgres, Storage, Auth, Stripe, Gemini — as chaves moram lá) e também
// devolve o uso de armazenamento (tamanho do banco + buckets); a Serverless
// Function da Vercel checa o Mercado Pago (só a chave dele mora lá). O
// painel busca as duas e junta num status só. Uma fonte falhar não deve
// esconder a outra — por isso Promise.allSettled em vez de Promise.all.
export async function fetchSystemStatus(): Promise<SystemStatusResult> {
  const header = await authHeader()

  const [supabaseResult, vercelResult] = await Promise.allSettled([
    supabase.functions.invoke('system-status', { method: 'GET' }),
    fetch('/api/system-status', { headers: { Authorization: header } }).then((res) => res.json()),
  ])

  const checks: StatusCheck[] = []
  let storage: StorageUsage | null = null

  if (supabaseResult.status === 'fulfilled' && !supabaseResult.value.error) {
    const data = supabaseResult.value.data as { checks?: StatusCheck[]; storage?: StorageUsage | null } | null
    checks.push(...(data?.checks ?? []))
    storage = data?.storage ?? null
  } else {
    checks.push(errorCheck('supabase_edge', 'o Supabase (Edge Functions)'))
  }

  if (vercelResult.status === 'fulfilled' && Array.isArray((vercelResult.value as { checks?: StatusCheck[] })?.checks)) {
    checks.push(...(vercelResult.value as { checks: StatusCheck[] }).checks)
  } else {
    checks.push(errorCheck('mercadopago', 'o Mercado Pago'))
  }

  return { checks, storage }
}
