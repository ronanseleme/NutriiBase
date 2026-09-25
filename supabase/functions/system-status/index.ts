// Supabase Edge Function: system-status
//
// Painel de status (Admin > Status) chama isso pra saber se as peças que
// rodam do lado do Supabase estão de pé: o Postgres, o Storage, o Auth, e
// as duas IAs/cobranças cujas chaves moram aqui (Stripe e Gemini). O Mercado
// Pago não entra aqui — a chave dele mora nas env vars da Vercel, então o
// frontend consulta um endpoint separado (/api/system-status) pra isso.
//
// Só admin pode chamar — os testes batem em APIs de terceiros de verdade
// (ainda que baratos/gratuitos), então não expomos isso pra qualquer usuário
// logado gerar tráfego à toa.
//
// Também devolve o uso de armazenamento (tamanho do banco Postgres +
// buckets do Storage) contra as cotas incluídas no plano Pro do Supabase —
// via a função admin_storage_stats() (RPC, admin-only).
//
// Deploy: supabase functions deploy system-status
// Secrets usadas (já configuradas por outras functions): STRIPE_SECRET_KEY,
// GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripeGet } from "../_shared/stripe.ts";

// Cotas incluídas no plano Pro do Supabase (confirmadas na doc oficial em
// 2026-09 — https://supabase.com/docs/guides/platform/billing-on-supabase).
// Acima disso é cobrança por uso, não um limite rígido, mas serve como
// referência de "quanto ainda cabe no incluso do plano".
const DB_QUOTA_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB de disco por projeto
const STORAGE_QUOTA_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB de Storage

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message } }, status);
}

interface StatusCheck {
  key: string;
  label: string;
  status: "ok" | "error";
  latencyMs: number | null;
  message: string | null;
}

async function timed(key: string, label: string, fn: () => Promise<string | null>): Promise<StatusCheck> {
  const start = Date.now();
  try {
    const message = await fn();
    return { key, label, status: "ok", latencyMs: Date.now() - start, message };
  } catch (err) {
    return {
      key,
      label,
      status: "error",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Falha desconhecida.",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("unauthorized", "Faça login para ver o status.", 401);
  }
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return errorResponse("upstream_error", "Configuração do servidor incompleta.", 500);
  }

  const supabaseAsUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse("unauthorized", "Sessão inválida ou expirada.", 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: profileRow, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profileRow) {
    return errorResponse("upstream_error", "Não foi possível verificar seu acesso.", 500);
  }
  if (profileRow.role !== "admin") {
    return errorResponse("forbidden", "Restrito a administradores.", 403);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  const checks = await Promise.all([
    timed("supabase_db", "Banco de dados (Postgres)", async () => {
      const { error } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).limit(1);
      if (error) throw new Error(error.message);
      return null;
    }),
    timed("supabase_storage", "Storage", async () => {
      const { data, error } = await supabaseAdmin.storage.listBuckets();
      if (error) throw new Error(error.message);
      return `${data?.length ?? 0} bucket(s)`;
    }),
    timed("supabase_auth", "Auth", async () => {
      const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) throw new Error(error.message);
      return null;
    }),
    timed("stripe", "Stripe (pagamentos por cartão)", async () => {
      if (!stripeKey) throw new Error("STRIPE_SECRET_KEY não configurada.");
      const res = await stripeGet("balance", stripeKey);
      if (!res.ok) throw new Error(`Stripe respondeu ${res.status}`);
      return null;
    }),
    timed("gemini", "Gemini (IA)", async () => {
      if (!geminiKey) throw new Error("GEMINI_API_KEY não configurada.");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${geminiKey}`,
      );
      if (!res.ok) throw new Error(`Gemini respondeu ${res.status}`);
      return null;
    }),
  ]);

  let storage: unknown = null;
  const { data: storageStats, error: storageError } = await supabaseAdmin.rpc("admin_storage_stats");
  if (!storageError && storageStats) {
    const dbBytes = Number((storageStats as { dbBytes: number }).dbBytes) || 0;
    const buckets = (storageStats as { buckets: { bucket: string; bytes: number; objects: number }[] }).buckets || [];
    const storageBytes = buckets.reduce((sum, b) => sum + (Number(b.bytes) || 0), 0);
    storage = {
      dbBytes,
      dbQuotaBytes: DB_QUOTA_BYTES,
      storageBytes,
      storageQuotaBytes: STORAGE_QUOTA_BYTES,
      buckets: buckets.map((b) => ({ bucket: b.bucket, bytes: Number(b.bytes) || 0, objects: Number(b.objects) || 0 })),
    };
  }

  return jsonResponse({ checks, storage, checkedAt: new Date().toISOString() });
});
