// Supabase Edge Function: create-checkout-session
//
// Usuário logado escolhe um plano (priceId, devolvido por list-plans) e essa
// função cria uma sessão de Checkout hospedada pelo Stripe — o app só
// redireciona o navegador pra URL devolvida. Nenhum dado de cartão passa
// pelo nosso servidor.
//
// A confirmação real (virar Pro de fato) acontece depois, via webhook
// (checkout.session.completed) — não aqui, porque o usuário pode fechar a
// aba antes de terminar de pagar.
//
// Deploy: supabase functions deploy create-checkout-session
// Secret: supabase secrets set STRIPE_SECRET_KEY=sk_...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripeGet, stripePost } from "../_shared/stripe.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mesmos 4 produtos de list-plans — valida que o priceId recebido do
// frontend realmente pertence a um deles antes de mandar pro Stripe
// (nunca confia cegamente num valor vindo do cliente).
const ALLOWED_PRODUCT_IDS = ["prod_VG53dMDufAq4mz", "prod_VG57rA5pRCN02x", "prod_VG5BIw7P5Rk4bB", "prod_VG5GcfW4tb9ARB"];

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
    return errorResponse("unauthorized", "Faça login para assinar.", 401);
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

  let body: { priceId?: string; successUrl?: string; cancelUrl?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Corpo da requisição inválido.", 400);
  }
  const { priceId, successUrl, cancelUrl } = body;
  if (!priceId || !successUrl || !cancelUrl) {
    return errorResponse("bad_request", "Faltam priceId/successUrl/cancelUrl.", 400);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return errorResponse("upstream_error", "Cobrança não configurada no servidor.", 500);
  }

  // Confere que o priceId pertence a um dos 4 produtos permitidos antes de
  // criar a sessão — busca o preço no Stripe pra pegar o product associado.
  const priceCheck = await stripeGet(`prices/${priceId}`, stripeKey, { "expand[]": "product" });
  if (!priceCheck.ok) {
    return errorResponse("bad_request", "Plano inválido.", 400);
  }
  const priceJson = await priceCheck.json();
  const productId = typeof priceJson.product === "string" ? priceJson.product : priceJson.product?.id;
  if (!ALLOWED_PRODUCT_IDS.includes(productId)) {
    return errorResponse("bad_request", "Plano inválido.", 400);
  }

  // Perfil próprio, pra saber se já é Cliente Stripe (reaproveita) ou não
  // (deixa o Stripe criar um Cliente novo a partir do e-mail).
  const { data: profileRow } = await supabaseClient
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userData.user.id)
    .single();

  const params: Record<string, unknown> = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userData.user.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: "true",
  };
  if (profileRow?.stripe_customer_id) {
    params.customer = profileRow.stripe_customer_id;
  } else if (userData.user.email) {
    params.customer_email = userData.user.email;
  }

  let sessionRes: Response;
  try {
    sessionRes = await stripePost("checkout/sessions", stripeKey, params);
  } catch {
    return errorResponse("upstream_error", "Não foi possível iniciar o pagamento agora.", 502);
  }
  if (!sessionRes.ok) {
    console.error("create-checkout-session: Stripe respondeu", sessionRes.status, await sessionRes.text());
    return errorResponse("upstream_error", "Não foi possível iniciar o pagamento agora.", 502);
  }
  const session = await sessionRes.json();
  return jsonResponse({ url: session.url });
});
