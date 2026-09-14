// Supabase Edge Function: create-portal-session
//
// Usuário Pro clica em "Gerenciar assinatura" — essa função cria uma sessão
// do Portal do Cliente do Stripe (trocar cartão, ver faturas, cancelar) e
// devolve a URL. Todo o resto acontece no site do Stripe, hospedado por eles.
//
// Deploy: supabase functions deploy create-portal-session
// Secret: supabase secrets set STRIPE_SECRET_KEY=sk_...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripePost } from "../_shared/stripe.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse("bad_request", "Use POST.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("unauthorized", "Faça login para gerenciar sua assinatura.", 401);
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("upstream_error", "Configuração do servidor incompleta.", 500);
  }
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse("unauthorized", "Sessão inválida ou expirada.", 401);
  }

  let body: { returnUrl?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Corpo da requisição inválido.", 400);
  }
  if (!body.returnUrl) {
    return errorResponse("bad_request", "Falta returnUrl.", 400);
  }

  const { data: profileRow } = await supabaseClient
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userData.user.id)
    .single();
  if (!profileRow?.stripe_customer_id) {
    return errorResponse("no_subscription", "Você ainda não tem uma assinatura ativa.", 400);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return errorResponse("upstream_error", "Cobrança não configurada no servidor.", 500);
  }

  let sessionRes: Response;
  try {
    sessionRes = await stripePost("billing_portal/sessions", stripeKey, {
      customer: profileRow.stripe_customer_id,
      return_url: body.returnUrl,
    });
  } catch {
    return errorResponse("upstream_error", "Não foi possível abrir o portal de cobrança agora.", 502);
  }
  if (!sessionRes.ok) {
    console.error("create-portal-session: Stripe respondeu", sessionRes.status, await sessionRes.text());
    return errorResponse("upstream_error", "Não foi possível abrir o portal de cobrança agora.", 502);
  }
  const session = await sessionRes.json();
  return jsonResponse({ url: session.url });
});
