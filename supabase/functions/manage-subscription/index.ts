// Supabase Edge Function: manage-subscription
//
// Cancela (agenda pro fim do período já pago) ou reativa a assinatura
// recorrente do usuário logado, direto pela API do Stripe — sem precisar
// mandar a pessoa pro Portal do Cliente hospedado só pra fazer isso.
//
// Deploy: supabase functions deploy manage-subscription
// Secret: supabase secrets set STRIPE_SECRET_KEY=sk_...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripeGet, stripePost } from "../_shared/stripe.ts";

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

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Corpo da requisição inválido.", 400);
  }
  if (body.action !== "cancel" && body.action !== "reactivate") {
    return errorResponse("bad_request", "action precisa ser 'cancel' ou 'reactivate'.", 400);
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

  // Busca a assinatura ativa desse cliente — nunca confia num ID vindo do
  // corpo da requisição, sempre resolve pelo stripe_customer_id do próprio
  // perfil logado, pra garantir que a pessoa só mexe na assinatura dela.
  const subsRes = await stripeGet("subscriptions", stripeKey, {
    customer: profileRow.stripe_customer_id,
    status: "all",
    limit: 1,
  });
  if (!subsRes.ok) {
    console.error("manage-subscription: Stripe respondeu", subsRes.status, await subsRes.text());
    return errorResponse("upstream_error", "Não foi possível localizar sua assinatura agora.", 502);
  }
  const subsJson = await subsRes.json();
  const sub = subsJson.data?.[0];
  if (!sub) {
    return errorResponse("no_subscription", "Nenhuma assinatura encontrada.", 400);
  }

  const updateRes = await stripePost(`subscriptions/${sub.id}`, stripeKey, {
    cancel_at_period_end: body.action === "cancel" ? "true" : "false",
  });
  if (!updateRes.ok) {
    console.error("manage-subscription: Stripe respondeu", updateRes.status, await updateRes.text());
    return errorResponse("upstream_error", "Não foi possível atualizar sua assinatura agora.", 502);
  }
  const updated = await updateRes.json();
  return jsonResponse({ cancelAtPeriodEnd: !!updated.cancel_at_period_end });
});
